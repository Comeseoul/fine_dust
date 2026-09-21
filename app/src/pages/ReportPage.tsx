import { useMemo, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import RegionPicker from '../components/domain/RegionPicker'
import InsightList from '../components/domain/InsightList'
import GradeDistribution from '../components/charts/GradeDistribution'
import TrendChart, { type TrendPoint } from '../components/charts/TrendChart'
import { SourceNotice } from '../components/domain/SourceNotice'
import { Button, Card, Section, Segmented, Skeleton, StateBlock } from '../components/ui'
import { useDaily } from '../hooks/useAirData'
import { PERIOD_OPTIONS, usePeriod, type PeriodKey } from '../hooks/usePeriod'
import { useSettings } from '../store/SettingsContext'
import { MOCK_STATION_MAP } from '../api/mock'
import {
  buildInsights,
  compareWithPrevious,
  gradeCounts,
  longestBadStreak,
  summarize,
} from '../lib/analytics'
import { GRADE_LABEL, POLLUTANT_LABEL, POLLUTANT_SHORT, badThreshold, toGrade } from '../lib/grade'
import { downloadCsv, safeFilename } from '../lib/export'
import { formatDateKo, parseYMD, weekdayKo } from '../lib/date'
import './pages.css'

export default function ReportPage() {
  const { sido, station, pollutant, setPollutant } = useSettings()
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d')
  const period = usePeriod(periodKey)
  const target = station || MOCK_STATION_MAP[sido]?.[0] || ''

  const curQ = useDaily(sido, target, period.from, period.to)
  const prevQ = useDaily(sido, target, period.prevFrom, period.prevTo)

  const days = curQ.data?.data ?? []
  const prevDays = prevQ.data?.data ?? []

  const summary = useMemo(() => summarize(days, pollutant), [days, pollutant])
  const comparison = useMemo(
    () => compareWithPrevious(days, prevDays, pollutant),
    [days, prevDays, pollutant],
  )
  const insights = useMemo(
    () => buildInsights(days, pollutant, summary, comparison, period.label),
    [days, pollutant, summary, comparison, period.label],
  )
  const counts = useMemo(() => gradeCounts(days, pollutant), [days, pollutant])
  const streak = useMemo(() => longestBadStreak(days, pollutant), [days, pollutant])

  const trend: TrendPoint[] = useMemo(
    () =>
      days.map((d) => ({
        label: d.date.slice(5).replace('-', '/'),
        pm10: d.pm10Avg,
        pm25: d.pm25Avg,
        hint: d.date,
      })),
    [days],
  )

  const issuedAt = new Date()
  const sourceLabel =
    curQ.data?.source === 'live'
      ? '에어코리아 오픈 API (한국환경공단)'
      : '데모 데이터 (합성 · 실제 관측값 아님)'

  const exportCsv = () => {
    downloadCsv(
      `${safeFilename(`미세먼지_리포트_${sido}_${target}_${period.from}_${period.to}`)}.csv`,
      ['날짜', '요일', 'PM10 일평균', 'PM2.5 일평균', '등급'],
      days.map((d) => [
        d.date,
        weekdayKo(parseYMD(d.date)),
        d.pm10Avg,
        d.pm25Avg,
        GRADE_LABEL[toGrade(pollutant === 'pm10' ? d.pm10Avg : d.pm25Avg, pollutant)],
      ]),
    )
  }

  return (
    <>
      <TopBar title="분석 리포트" sub={`${target || sido} · ${period.label}`} right={<RegionPicker />} />

      <div className="filterbar no-print">
        <Segmented label="기간" options={PERIOD_OPTIONS} value={periodKey} onChange={setPeriodKey} />
        <Segmented
          label="항목"
          options={[
            { value: 'pm25', label: 'PM2.5 초미세먼지' },
            { value: 'pm10', label: 'PM10 미세먼지' },
          ]}
          value={pollutant}
          onChange={setPollutant}
        />
      </div>

      <div className="page">
        <SourceNotice ds={curQ.data} />

        {curQ.isLoading ? (
          <Card>
            <Skeleton h={320} r={12} />
          </Card>
        ) : days.length === 0 ? (
          <Card>
            <StateBlock icon="📄" title="리포트를 만들 자료가 없어요" desc="기간이나 측정소를 바꿔보세요." />
          </Card>
        ) : (
          <>
            {/* ---- 리포트 본문 (인쇄 대상) -------------------------------- */}
            <article className="report print-page">
              <h2 className="report__title">
                {sido} {target} {POLLUTANT_LABEL[pollutant]} 분석 리포트
              </h2>
              <p className="report__meta">
                분석 기간 {period.from} ~ {period.to} ({period.days}일) · 발행 {formatDateKo(issuedAt)}
                <br />
                자료 출처 {sourceLabel}
              </p>

              <h3 className="report__h">1. 요약</h3>
              <dl className="report__kv">
                <dt>기간 평균</dt>
                <dd>{summary.avg === null ? '-' : Math.round(summary.avg)} ㎍/㎥</dd>
                <dt>최고 일평균</dt>
                <dd>
                  {summary.max === null ? '-' : Math.round(summary.max)} ㎍/㎥
                  {summary.worstDate ? ` (${summary.worstDate})` : ''}
                </dd>
                <dt>최저 일평균</dt>
                <dd>{summary.min === null ? '-' : Math.round(summary.min)} ㎍/㎥</dd>
                <dt>나쁨 이상 일수</dt>
                <dd>
                  {summary.badDays}일 / {summary.validDays}일
                </dd>
                <dt>최장 연속 초과</dt>
                <dd>{streak.length}일</dd>
                <dt>직전 기간 대비</dt>
                <dd>
                  {comparison.changePct === null
                    ? '-'
                    : `${comparison.changePct > 0 ? '+' : ''}${comparison.changePct.toFixed(1)}%`}
                </dd>
                <dt>자료 수집률</dt>
                <dd>{summary.coverage}%</dd>
              </dl>

              <h3 className="report__h">2. 분석 결과</h3>
              <InsightList items={insights} />

              <h3 className="report__h">3. 판정 기준</h3>
              <p className="report__p">
                환경부 대기환경기준 4단계(좋음·보통·나쁨·매우나쁨)를 적용했습니다.
                {POLLUTANT_SHORT[pollutant]}의 '나쁨' 기준은 일평균 {badThreshold(pollutant)}㎍/㎥ 초과입니다.
                결측일은 평균 계산에서 제외했으며, 그 비율은 위 자료 수집률에 반영했습니다.
              </p>
            </article>

            {/* ---- 도표 ---------------------------------------------------- */}
            <div className="print-page">
              <TrendChart
                title="일별 농도 추이"
                sub={`${period.label} · 일평균`}
                data={trend}
                height={200}
              />
            </div>

            <div className="print-page">
              <GradeDistribution
                title="등급별 일수 분포"
                sub={`${POLLUTANT_SHORT[pollutant]} 일평균 기준`}
                counts={counts}
              />
            </div>

            {/* ---- 출력 --------------------------------------------------- */}
            <Section title="출력">
              <div className="stack gap-8 no-print">
                <Button block onClick={() => window.print()}>
                  인쇄 · PDF로 저장
                </Button>
                <Button variant="secondary" block onClick={exportCsv}>
                  원자료 CSV 내려받기
                </Button>
                <p className="t-caption c-tertiary" style={{ textAlign: 'center' }}>
                  인쇄 화면에서 '대상'을 PDF로 저장하면 그대로 문서가 됩니다.
                </p>
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  )
}
