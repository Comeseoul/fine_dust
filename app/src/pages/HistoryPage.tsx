import { useMemo, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import RegionPicker from '../components/domain/RegionPicker'
import GradeBadge from '../components/domain/GradeBadge'
import { SourceLine, SourceNotice } from '../components/domain/SourceNotice'
import { Button, Card, Chip, Section, Segmented, Sheet, Skeleton, StateBlock } from '../components/ui'
import { useDaily } from '../hooks/useAirData'
import { useSettings } from '../store/SettingsContext'
import { MOCK_STATION_MAP } from '../api/mock'
import { addDays, parseYMD, toYMD, weekdayKo } from '../lib/date'
import { GRADE_LABEL, POLLUTANT_SHORT, toGrade } from '../lib/grade'
import { downloadCsv, downloadJson, safeFilename } from '../lib/export'
import { summarize } from '../lib/analytics'
import type { DailyAggregate, GradeLevel } from '../lib/types'
import './pages.css'

type SortKey = 'date-desc' | 'date-asc' | 'value-desc' | 'value-asc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date-desc', label: '최신순' },
  { value: 'date-asc', label: '오래된순' },
  { value: 'value-desc', label: '농도 높은순' },
  { value: 'value-asc', label: '농도 낮은순' },
]

export default function HistoryPage() {
  const { sido, station, pollutant, setPollutant } = useSettings()
  const target = station || MOCK_STATION_MAP[sido]?.[0] || ''

  const today = new Date()
  const [from, setFrom] = useState(toYMD(addDays(today, -30)))
  const [to, setTo] = useState(toYMD(addDays(today, -1)))
  const [sort, setSort] = useState<SortKey>('date-desc')
  const [gradeFilter, setGradeFilter] = useState<GradeLevel[]>([])
  const [detail, setDetail] = useState<DailyAggregate | null>(null)

  const invalidRange = parseYMD(from) > parseYMD(to)
  const q = useDaily(sido, target, invalidRange ? '' : from, invalidRange ? '' : to)
  const days = q.data?.data ?? []

  const key = pollutant === 'pm10' ? 'pm10Avg' : 'pm25Avg'

  const rows = useMemo(() => {
    let r = days.filter((d) => {
      if (gradeFilter.length === 0) return true
      return gradeFilter.includes(toGrade(d[key], pollutant))
    })
    r = [...r].sort((a, b) => {
      switch (sort) {
        case 'date-asc':
          return a.date.localeCompare(b.date)
        case 'value-desc':
          return (b[key] ?? -1) - (a[key] ?? -1)
        case 'value-asc':
          return (a[key] ?? Number.MAX_SAFE_INTEGER) - (b[key] ?? Number.MAX_SAFE_INTEGER)
        default:
          return b.date.localeCompare(a.date)
      }
    })
    return r
  }, [days, gradeFilter, sort, key, pollutant])

  const summary = useMemo(() => summarize(days, pollutant), [days, pollutant])

  const baseName = safeFilename(`미세먼지_이력_${sido}_${target}_${from}_${to}`)

  const exportCsv = () => {
    downloadCsv(
      `${baseName}.csv`,
      ['날짜', '요일', 'PM10 일평균(㎍/㎥)', 'PM2.5 일평균(㎍/㎥)', 'PM10 등급', 'PM2.5 등급', '유효관측수'],
      rows.map((d) => [
        d.date,
        weekdayKo(parseYMD(d.date)),
        d.pm10Avg,
        d.pm25Avg,
        GRADE_LABEL[toGrade(d.pm10Avg, 'pm10')],
        GRADE_LABEL[toGrade(d.pm25Avg, 'pm25')],
        d.count,
      ]),
    )
  }

  const exportJson = () => {
    downloadJson(`${baseName}.json`, {
      조회조건: { 시도: sido, 측정소: target, 시작일: from, 종료일: to, 항목: POLLUTANT_SHORT[pollutant] },
      출처: q.data?.source === 'live' ? '에어코리아(한국환경공단)' : '데모 데이터(합성)',
      조회시각: q.data?.fetchedAt,
      건수: rows.length,
      자료: rows,
    })
  }

  const toggleGrade = (g: GradeLevel) =>
    setGradeFilter((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))

  return (
    <>
      <TopBar title="측정 이력" sub={`${target || sido} · ${rows.length}건`} right={<RegionPicker />} />

      <div className="page">
        {/* ---- 조회 조건 --------------------------------------------------- */}
        <Card className="stack gap-12 no-print">
          <div className="stack gap-6">
            <span className="t-label c-secondary">조회 기간</span>
            <div className="daterow">
              <input
                className="dateinput"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="시작일"
              />
              <span className="c-tertiary" aria-hidden>
                ~
              </span>
              <input
                className="dateinput"
                type="date"
                value={to}
                min={from}
                max={toYMD(today)}
                onChange={(e) => setTo(e.target.value)}
                aria-label="종료일"
              />
            </div>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {[7, 30, 90, 365].map((n) => (
                <Chip
                  key={n}
                  onClick={() => {
                    setTo(toYMD(addDays(today, -1)))
                    setFrom(toYMD(addDays(today, -n)))
                  }}
                >
                  최근 {n === 365 ? '1년' : `${n}일`}
                </Chip>
              ))}
            </div>
          </div>

          <Segmented
            label="측정 항목"
            options={[
              { value: 'pm25', label: 'PM2.5' },
              { value: 'pm10', label: 'PM10' },
            ]}
            value={pollutant}
            onChange={setPollutant}
          />

          <div className="stack gap-6">
            <span className="t-label c-secondary">등급 필터</span>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {([1, 2, 3, 4] as GradeLevel[]).map((g) => (
                <Chip key={g} pressed={gradeFilter.includes(g)} onClick={() => toggleGrade(g)}>
                  {GRADE_LABEL[g]}
                </Chip>
              ))}
              {gradeFilter.length > 0 && (
                <Chip onClick={() => setGradeFilter([])}>전체 해제</Chip>
              )}
            </div>
          </div>

          <Segmented label="정렬" options={SORT_OPTIONS} value={sort} onChange={setSort} />
        </Card>

        <SourceNotice ds={q.data} />

        {invalidRange ? (
          <Card>
            <StateBlock icon="⚠" title="시작일이 종료일보다 늦어요" desc="기간을 다시 선택해 주세요." />
          </Card>
        ) : q.isLoading ? (
          <Card>
            <Skeleton h={240} r={12} />
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <StateBlock
              icon="📭"
              title="조건에 맞는 이력이 없어요"
              desc="기간을 넓히거나 등급 필터를 해제해 보세요."
            />
          </Card>
        ) : (
          <>
            <Section
              title="조회 결과"
              desc={`${from} ~ ${to} · 평균 ${summary.avg === null ? '-' : Math.round(summary.avg)}㎍/㎥ · 나쁨 이상 ${summary.badDays}일`}
            >
              <Card variant="tight">
                <div className="tableview">
                  <table className="dtable">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>PM10</th>
                        <th>PM2.5</th>
                        <th>등급</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr
                          key={d.date}
                          onClick={() => setDetail(d)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            {d.date.slice(5)}
                            <span className="c-tertiary"> ({weekdayKo(parseYMD(d.date))})</span>
                          </td>
                          <td className="num">{d.pm10Avg ?? '-'}</td>
                          <td className="num">{d.pm25Avg ?? '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <GradeBadge grade={toGrade(d[key], pollutant)} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Section>

            {/* ---- 내보내기 ------------------------------------------------ */}
            <Section title="내보내기" desc="조회 조건과 출처가 함께 기록됩니다">
              <div className="row gap-8 no-print">
                <Button variant="secondary" block onClick={exportCsv}>
                  CSV 내려받기
                </Button>
                <Button variant="secondary" block onClick={exportJson}>
                  JSON 내려받기
                </Button>
              </div>
            </Section>

            <SourceLine ds={q.data} />
          </>
        )}
      </div>

      {/* ---- 일자 상세 ---------------------------------------------------- */}
      <Sheet
        open={detail !== null}
        title={detail ? `${detail.date} (${weekdayKo(parseYMD(detail.date))})` : ''}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="stack gap-16">
            <dl className="report__kv">
              <dt>측정소</dt>
              <dd>{target}</dd>
              <dt>PM10 일평균</dt>
              <dd>{detail.pm10Avg ?? '-'} ㎍/㎥</dd>
              <dt>PM10 최고</dt>
              <dd>{detail.pm10Max ?? '-'} ㎍/㎥</dd>
              <dt>PM2.5 일평균</dt>
              <dd>{detail.pm25Avg ?? '-'} ㎍/㎥</dd>
              <dt>PM2.5 최고</dt>
              <dd>{detail.pm25Max ?? '-'} ㎍/㎥</dd>
              <dt>유효 관측</dt>
              <dd>{detail.count}회</dd>
            </dl>
            <div className="row gap-8">
              <GradeBadge grade={toGrade(detail.pm10Avg, 'pm10')} />
              <span className="t-caption c-tertiary">PM10</span>
              <GradeBadge grade={toGrade(detail.pm25Avg, 'pm25')} />
              <span className="t-caption c-tertiary">PM2.5</span>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
