import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import RegionPicker from '../components/domain/RegionPicker'
import GradeBadge from '../components/domain/GradeBadge'
import { SourceLine, SourceNotice } from '../components/domain/SourceNotice'
import TrendChart, { type TrendPoint } from '../components/charts/LazyTrendChart'
import RankBars from '../components/charts/RankBars'
import { Card, Section, Skeleton, StateBlock } from '../components/ui'
import { useForecast, useHourly, useNationwide, useSidoStations } from '../hooks/useAirData'
import { useSettings } from '../store/SettingsContext'
import {
  GRADE_ADVICE,
  GRADE_CSS_VAR,
  GRADE_ICON,
  GRADE_LABEL,
  POLLUTANT_LABEL,
  POLLUTANT_SHORT,
  toGrade,
  worseGrade,
} from '../lib/grade'
import { SIDO_TO_FORECAST_REGION } from '../lib/config'
import { formatDateTimeShort, timeAgo } from '../lib/date'
import { mean } from '../lib/format'
import './pages.css'

export default function NowPage() {
  const { sido, station, pollutant, setStation } = useSettings()
  const navigate = useNavigate()

  const sidoQ = useSidoStations(sido)
  // 측정소를 고른 경우에만 시간별 추이를 부른다. 미선택이면 시도 평균만 본다.
  const hourlyQ = useHourly(sido, station, 'DAILY')
  const nationQ = useNationwide()
  const forecastQ = useForecast()

  const observations = sidoQ.data?.data ?? []

  /** 화면 상단 대표값 — 측정소 선택 시 그 측정소, 아니면 시도 평균 */
  const current = useMemo(() => {
    if (station) {
      const list = hourlyQ.data?.data ?? []
      const last = [...list].reverse().find((o) => o.pm10 !== null || o.pm25 !== null)
      if (last) return { pm10: last.pm10, pm25: last.pm25, at: last.at, label: station }
      const fromSido = observations.find((o) => o.stationName === station)
      if (fromSido) {
        return { pm10: fromSido.pm10, pm25: fromSido.pm25, at: fromSido.at, label: station }
      }
    }
    if (observations.length === 0) return null
    return {
      pm10: mean(observations.map((o) => o.pm10)),
      pm25: mean(observations.map((o) => o.pm25)),
      at: observations[0]?.at,
      label: `${sido} 평균`,
    }
  }, [station, hourlyQ.data, observations, sido])

  const gPm10 = toGrade(current?.pm10 ?? null, 'pm10')
  const gPm25 = toGrade(current?.pm25 ?? null, 'pm25')
  const representative = worseGrade(gPm10, gPm25)

  const trend: TrendPoint[] = useMemo(
    () =>
      (hourlyQ.data?.data ?? []).map((o) => {
        const d = new Date(o.at)
        return {
          label: `${d.getHours()}시`,
          pm10: o.pm10 ?? null,
          pm25: o.pm25 ?? null,
          hint: formatDateTimeShort(d),
        }
      }),
    [hourlyQ.data],
  )

  const stationRank = useMemo(
    () =>
      [...observations]
        .filter((o) => o[pollutant] !== null)
        .sort((a, b) => (b[pollutant] ?? 0) - (a[pollutant] ?? 0))
        .slice(0, 10)
        .map((o) => ({ name: o.stationName, value: o[pollutant] ?? null })),
    [observations, pollutant],
  )

  const nationRank = useMemo(() => {
    const key = pollutant === 'pm10' ? 'pm10Avg' : 'pm25Avg'
    return [...(nationQ.data?.data ?? [])]
      .filter((s) => s[key] !== null)
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .map((s) => ({ name: s.sidoName, value: s[key] === null ? null : Math.round(s[key]!) }))
  }, [nationQ.data, pollutant])

  const myForecast = useMemo(() => {
    const region = SIDO_TO_FORECAST_REGION[sido] ?? sido
    return (forecastQ.data?.data ?? []).map((f) => ({
      code: f.informCode,
      target: f.targetDate,
      grade:
        f.regions.find((r) => r.region === region)?.grade ??
        f.regions.find((r) => r.region.startsWith(sido))?.grade ??
        f.overall,
      cause: f.cause,
    }))
  }, [forecastQ.data, sido])

  return (
    <>
      <TopBar
        title="지금 우리 동네"
        sub={current?.at ? `${timeAgo(new Date(current.at))} 측정` : '측정 시각 확인 중'}
        right={<RegionPicker />}
      />

      <div className="page">
        <SourceNotice ds={sidoQ.data} />

        {/* ---- Hero ------------------------------------------------------- */}
        {sidoQ.isLoading && !current ? (
          <Card className="c-4">
            <Skeleton h={22} w={110} />
            <div style={{ height: 14 }} />
            <Skeleton h={54} w={190} />
            <div style={{ height: 14 }} />
            <Skeleton h={16} w="70%" />
          </Card>
        ) : !current ? (
          <Card className="c-4">
            <StateBlock
              icon="🛰"
              title="측정값을 불러오지 못했어요"
              desc="잠시 후 다시 시도하거나, 설정 화면에서 오픈 API 연결 상태를 확인해 주세요."
            />
          </Card>
        ) : (
          <Card className="hero c-4" style={{ background: `var(--grade-${representative}-bg)` }}>
            <div className="row between gap-12">
              <span className="t-label" style={{ color: GRADE_CSS_VAR[representative] }}>
                {current.label}
              </span>
              <GradeBadge grade={representative} />
            </div>

            <div className="hero__figure" style={{ color: GRADE_CSS_VAR[representative] }}>
              <span className="hero__icon" aria-hidden>
                {GRADE_ICON[representative]}
              </span>
              <span className="hero__word">{GRADE_LABEL[representative]}</span>
            </div>

            <p className="hero__advice">{GRADE_ADVICE[representative]}</p>

            <div className="hero__split">
              <PollutantCell label={POLLUTANT_SHORT.pm10} name={POLLUTANT_LABEL.pm10} value={current.pm10} grade={gPm10} />
              <span className="hero__divider" aria-hidden />
              <PollutantCell label={POLLUTANT_SHORT.pm25} name={POLLUTANT_LABEL.pm25} value={current.pm25} grade={gPm25} />
            </div>
          </Card>
        )}

        {/* ---- 24시간 추이 -------------------------------------------------- */}
        {station ? (
          hourlyQ.isLoading ? (
            <Card className="c-8">
              <Skeleton h={220} r={12} />
            </Card>
          ) : trend.length > 0 ? (
            <div className="c-8">
              <TrendChart
                title="24시간 추이"
                sub={`${station} 측정소 · 시간별 농도`}
                data={trend}
                height={240}
                tableRows={<TrendTable data={trend} />}
              />
            </div>
          ) : null
        ) : (
          <Card variant="flat" className="c-8">
            <StateBlock
              icon="📈"
              title="시간별 추이를 보려면 측정소를 골라주세요"
              desc="상단의 지역 버튼에서 측정소를 선택하면 24시간 추이와 이력 분석을 볼 수 있어요."
            />
          </Card>
        )}

        {/* ---- 시도 내 측정소 랭킹 ------------------------------------------ */}
        {stationRank.length > 0 && (
          <div className="c-6"><RankBars
            title={`${sido} 측정소 순위`}
            sub={`${POLLUTANT_SHORT[pollutant]} 농도가 높은 곳부터`}
            items={stationRank}
            pollutant={pollutant}
            highlight={station}
            note="측정소를 누르면 해당 지점으로 기준이 바뀝니다."
            onSelect={setStation}
          /></div>
        )}

        {/* ---- 전국 비교 ---------------------------------------------------- */}
        {nationRank.length > 0 && (
          <div className="c-6"><RankBars
            title="전국 시·도 비교"
            sub={`${POLLUTANT_SHORT[pollutant]} 기준 · 17개 시·도`}
            items={nationRank}
            pollutant={pollutant}
            highlight={sido}
          /></div>
        )}

        {/* ---- 예보 -------------------------------------------------------- */}
        {myForecast.length > 0 && (
          <div className="c-4"><Section title="내일 예보" desc={`${SIDO_TO_FORECAST_REGION[sido] ?? sido} 권역`}>
            <Card className="stack gap-12">
              {myForecast.map((f) => (
                <div key={`${f.code}-${f.target}`} className="row between gap-12">
                  <div>
                    <div className="t-bodyB">
                      {f.code === 'PM10' ? '미세먼지' : '초미세먼지'}
                    </div>
                    <div className="t-caption c-tertiary">{f.target}</div>
                  </div>
                  <ForecastBadge grade={f.grade} />
                </div>
              ))}
              {myForecast[0]?.cause && (
                <p className="t-caption c-secondary" style={{ wordBreak: 'keep-all' }}>
                  {myForecast[0].cause}
                </p>
              )}
            </Card>
          </Section></div>
        )}

        <button className="page__cta" onClick={() => navigate('/stats')}>
          기간별 통계 보러가기 <span aria-hidden>›</span>
        </button>

        <SourceLine ds={sidoQ.data} />
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */

function PollutantCell({
  label,
  name,
  value,
  grade,
}: {
  label: string
  name: string
  value: number | null | undefined
  grade: ReturnType<typeof toGrade>
}) {
  return (
    <div className="hero__cell">
      <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
        {label} <span className="c-tertiary">{name}</span>
      </span>
      <div className="row gap-6" style={{ marginTop: 2 }}>
        <span className="hero__value t-num">
          {value === null || value === undefined ? '-' : Math.round(value)}
        </span>
        <span className="t-caption c-tertiary">㎍/㎥</span>
      </div>
      <div style={{ marginTop: 4 }}>
        <GradeBadge grade={grade} size="sm" />
      </div>
    </div>
  )
}

const FORECAST_GRADE_INDEX: Record<string, 1 | 2 | 3 | 4> = {
  좋음: 1,
  보통: 2,
  나쁨: 3,
  매우나쁨: 4,
}

function ForecastBadge({ grade }: { grade: string }) {
  const g = FORECAST_GRADE_INDEX[grade.trim()] ?? 0
  return <GradeBadge grade={g} />
}

function TrendTable({ data }: { data: TrendPoint[] }) {
  return (
    <table className="dtable">
      <thead>
        <tr>
          <th>시각</th>
          <th>PM10</th>
          <th>PM2.5</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={`${d.hint ?? d.label}-${i}`}>
            <td>{d.hint ?? d.label}</td>
            <td className="num">{d.pm10 ?? '-'}</td>
            <td className="num">{d.pm25 ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

