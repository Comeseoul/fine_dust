import { useMemo, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import RegionPicker from '../components/domain/RegionPicker'
import InsightList from '../components/domain/InsightList'
import { SourceLine, SourceNotice } from '../components/domain/SourceNotice'
import TrendChart, { type TrendPoint } from '../components/charts/TrendChart'
import GradeDistribution from '../components/charts/GradeDistribution'
import CalendarHeatmap from '../components/charts/CalendarHeatmap'
import RankBars from '../components/charts/RankBars'
import {
  CorrelationScatter,
  CumulativeBadChart,
  MonthlyGradeMix,
  MonthlyRangeChart,
} from '../components/charts/MoreCharts'
import { Card, Section, Segmented, Skeleton, StateBlock } from '../components/ui'
import { useDaily, useHourly } from '../hooks/useAirData'
import { PERIOD_OPTIONS, usePeriod, type PeriodKey } from '../hooks/usePeriod'
import { useSettings } from '../store/SettingsContext'
import {
  buildInsights,
  compareWithPrevious,
  correlation,
  cumulativeBadDays,
  gradeCounts,
  hourlyProfile,
  monthlyGradeMix,
  monthlyRanges,
  scatterPoints,
  summarize,
  weekdayAverages,
} from '../lib/analytics'
import { POLLUTANT_SHORT, badThreshold, toGrade, GRADE_LABEL, GRADE_CSS_VAR } from '../lib/grade'
import { MOCK_STATION_MAP } from '../api/mock'
import './pages.css'

export default function StatsPage() {
  const { sido, station, pollutant, setPollutant, setStation } = useSettings()
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d')
  const period = usePeriod(periodKey)

  const target = station || MOCK_STATION_MAP[sido]?.[0] || ''
  const isYear = periodKey === '12m'

  const curQ = useDaily(sido, target, period.from, period.to)
  const prevQ = useDaily(sido, target, period.prevFrom, period.prevTo)
  // 시간대별 패턴은 시간 단위 원자료가 필요하다 (최근 1개월분)
  const hourlyQ = useHourly(sido, target, 'MONTH')

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

  const counts = useMemo(() => gradeCounts(days, pollutant), [days, pollutant])
  const weekday = useMemo(() => weekdayAverages(days, pollutant), [days, pollutant])
  const ranges = useMemo(() => monthlyRanges(days, pollutant), [days, pollutant])
  const mix = useMemo(() => monthlyGradeMix(days, pollutant), [days, pollutant])
  const cumulative = useMemo(() => cumulativeBadDays(days, pollutant), [days, pollutant])
  const corr = useMemo(() => correlation(days), [days])
  const scatter = useMemo(() => scatterPoints(days), [days])
  const profile = useMemo(
    () => hourlyProfile(hourlyQ.data?.data ?? []),
    [hourlyQ.data],
  )

  const peakHour = useMemo(() => {
    const key = pollutant
    const valid = profile.filter((h) => h[key] !== null)
    if (valid.length === 0) return null
    return valid.reduce((a, b) => ((b[key] ?? 0) > (a[key] ?? 0) ? b : a))
  }, [profile, pollutant])

  const loading = curQ.isLoading

  return (
    <>
      <TopBar
        title="기간별 통계"
        sub={`${target || sido} · ${period.from} ~ ${period.to} (${period.days}일)`}
        right={<RegionPicker />}
      />

      <div className="filterbar no-print">
        <Segmented label="조회 기간" options={PERIOD_OPTIONS} value={periodKey} onChange={setPeriodKey} />
        <Segmented
          label="측정 항목"
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

        {loading ? (
          <>
            <Card><Skeleton h={60} r={12} /></Card>
            <Card><Skeleton h={220} r={12} /></Card>
          </>
        ) : days.length === 0 ? (
          <Card>
            <StateBlock
              icon="📭"
              title="이 기간의 자료가 없어요"
              desc="기간을 바꾸거나 다른 측정소를 선택해 보세요."
            />
          </Card>
        ) : (
          <>
            {/* ---- KPI 바 (데스크톱에서 6열) ------------------------------ */}
            <div className="kpibar">
              <Kpi
                label="기간 평균"
                value={summary.avg === null ? '-' : Math.round(summary.avg)}
                unit="㎍/㎥"
                sub={
                  comparison.changePct === null
                    ? undefined
                    : `${comparison.changePct > 0 ? '▲' : '▼'} ${Math.abs(comparison.changePct).toFixed(1)}%`
                }
                subColor={
                  comparison.changePct === null
                    ? undefined
                    : comparison.changePct > 0
                      ? 'var(--negative)'
                      : 'var(--positive)'
                }
              />
              <Kpi
                label="최고 일평균"
                value={summary.max === null ? '-' : Math.round(summary.max)}
                unit="㎍/㎥"
                sub={summary.worstDate ?? undefined}
              />
              <Kpi
                label="최저 일평균"
                value={summary.min === null ? '-' : Math.round(summary.min)}
                unit="㎍/㎥"
              />
              <Kpi
                label="나쁨 이상"
                value={summary.badDays}
                unit={`일`}
                sub={`전체 ${summary.validDays}일 중`}
              />
              <Kpi
                label="대표 등급"
                value={GRADE_LABEL[toGrade(summary.avg, pollutant)]}
                subColor={GRADE_CSS_VAR[toGrade(summary.avg, pollutant)]}
                sub={`기준 ${badThreshold(pollutant)}㎍/㎥ 초과 = 나쁨`}
              />
              <Kpi
                label="자료 수집률"
                value={summary.coverage}
                unit="%"
                sub={`${summary.validDays}/${summary.totalDays}일`}
              />
            </div>

            {/* ---- 인사이트 ----------------------------------------------- */}
            <div className="c-6">
              <Section title="이 기간에서 읽은 것" desc="계산된 지표만으로 작성된 요약입니다">
                <Card>
                  <InsightList items={insights} />
                </Card>
              </Section>
            </div>

            {/* ---- 등급 분포 ---------------------------------------------- */}
            <div className="c-6">
              <GradeDistribution
                title="등급별 일수 분포"
                sub={`${POLLUTANT_SHORT[pollutant]} 일평균 기준`}
                counts={counts}
              />
            </div>

            {/* ---- 일별 추이 (넓게) --------------------------------------- */}
            <div className="c-8">
              <TrendChart
                title="일별 농도 추이"
                sub={`${period.label} · 일평균`}
                data={trend}
                height={240}
                tableRows={
                  <table className="dtable">
                    <thead>
                      <tr><th>날짜</th><th>PM10</th><th>PM2.5</th></tr>
                    </thead>
                    <tbody>
                      {days.map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td className="num">{d.pm10Avg ?? '-'}</td>
                          <td className="num">{d.pm25Avg ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              />
            </div>

            {/* ---- 누적 초과일 -------------------------------------------- */}
            <div className="c-4">
              <CumulativeBadChart data={cumulative} pollutant={pollutant} />
            </div>

            {/* ---- 히트맵 ------------------------------------------------- */}
            {days.length <= 92 && (
              <div className="c-6">
                <CalendarHeatmap
                  title="날짜별 히트맵"
                  sub={`${POLLUTANT_SHORT[pollutant]} 일평균 · 숫자는 실제 농도(㎍/㎥)`}
                  days={days}
                  pollutant={pollutant}
                />
              </div>
            )}

            {/* ---- 상관 산점도 -------------------------------------------- */}
            <div className="c-6">
              <CorrelationScatter points={scatter} r={corr.r} n={corr.n} />
            </div>

            {/* ---- 시간대별 프로필 ---------------------------------------- */}
            <div className="c-6">
              {hourlyQ.isLoading ? (
                <Card><Skeleton h={200} r={12} /></Card>
              ) : (
                <TrendChart
                  title="시간대별 평균 프로필"
                  sub={
                    peakHour
                      ? `최근 1개월 · 하루 중 ${peakHour.label}에 가장 높았습니다`
                      : '최근 1개월 · 시간대별 평균'
                  }
                  data={profile}
                  height={200}
                  showThreshold={false}
                  tableRows={
                    <table className="dtable">
                      <thead>
                        <tr><th>시각</th><th>PM10</th><th>PM2.5</th></tr>
                      </thead>
                      <tbody>
                        {profile.map((h) => (
                          <tr key={h.label}>
                            <td>{h.label}</td>
                            <td className="num">{h.pm10 ?? '-'}</td>
                            <td className="num">{h.pm25 ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                />
              )}
            </div>

            {/* ---- 요일 패턴 ---------------------------------------------- */}
            <div className="c-6">
              <RankBars
                title="요일별 평균"
                sub="생활 패턴과 농도의 관계를 봅니다"
                items={weekday.map((w) => ({ name: `${w.label}요일`, value: w.value }))}
                pollutant={pollutant}
              />
            </div>

            {/* ---- 1년 조회 전용 ------------------------------------------ */}
            {isYear && ranges.length >= 3 && (
              <div className="c-6">
                <MonthlyRangeChart
                  title="월별 변동폭"
                  sub={`${POLLUTANT_SHORT[pollutant]} · 최근 12개월`}
                  data={ranges}
                  pollutant={pollutant}
                />
              </div>
            )}
            {isYear && mix.length >= 3 && (
              <div className="c-6">
                <MonthlyGradeMix data={mix} />
              </div>
            )}

            {!station && (
              <Card variant="flat">
                <StateBlock
                  icon="📍"
                  title={`${sido}의 ${target} 측정소 기준입니다`}
                  desc="상단 지역 버튼에서 다른 측정소를 고르면 해당 지점 기준으로 다시 계산돼요."
                  action={
                    <button className="btn btn--secondary btn--sm" onClick={() => setStation(target)}>
                      이 측정소로 고정
                    </button>
                  }
                />
              </Card>
            )}

            <SourceLine ds={curQ.data} />
          </>
        )}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */

function Kpi({
  label,
  value,
  unit,
  sub,
  subColor,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  sub?: string
  subColor?: string
}) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">
        {value}
        {unit && <span className="kpi__unit">{unit}</span>}
      </span>
      {sub && (
        <span className="kpi__sub" style={{ color: subColor ?? 'var(--text-tertiary)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}
