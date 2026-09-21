import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import ChartFrame from './ChartFrame'
import { GRADE_CSS_VAR, GRADE_ICON, GRADE_LABEL, POLLUTANT_SHORT } from '../../lib/grade'
import type { MonthRange } from '../../lib/analytics'
import type { GradeLevel, Pollutant } from '../../lib/types'
import './charts.css'

/* ==========================================================================
 *  1. 월별 범위 밴드 — 평균만으로는 안 보이는 '변동폭'을 보여준다.
 *     같은 평균 30이라도 20~40인 달과 5~90인 달은 전혀 다른 달이다.
 *
 *     설계(dataviz): 밴드는 채도를 낮춘 같은 색상(단일 hue)으로 깔고,
 *     평균선만 2px 실선으로 올린다. 축은 하나(㎍/㎥).
 * ========================================================================*/
export function MonthlyRangeChart({
  title,
  sub,
  data,
  pollutant,
}: {
  title: string
  sub?: string
  data: MonthRange[]
  pollutant: Extract<Pollutant, 'pm10' | 'pm25'>
}) {
  // Recharts 의 스택 Area 로 [min, min+span] 구간을 그린다.
  const rows = data.map((d) => ({ ...d, base: d.min ?? 0, band: d.span ?? 0 }))

  return (
    <ChartFrame
      title={title}
      sub={sub}
      note="띠는 그 달의 최저~최고 일평균 범위, 실선은 월평균입니다. 띠가 두꺼울수록 날짜별 편차가 큽니다."
      legend={[
        { label: '월평균', color: 'var(--viz-series-1)' },
        { label: '최저~최고 범위', color: 'var(--viz-ordinal-1)', shape: 'square' },
      ]}
      table={
        <table className="dtable">
          <thead>
            <tr>
              <th>월</th>
              <th>최저</th>
              <th>평균</th>
              <th>최고</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td className="num">{d.min ?? '-'}</td>
                <td className="num">{d.avg ?? '-'}</td>
                <td className="num">{d.max ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--viz-axis)' }}
          />
          <YAxis
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<RangeTooltip unit={POLLUTANT_SHORT[pollutant]} />} cursor={{ stroke: 'var(--viz-axis)' }} />
          {/* 바닥(투명) + 범위(반투명) 스택 */}
          <Area dataKey="base" stackId="r" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area
            dataKey="band"
            stackId="r"
            stroke="none"
            fill="var(--viz-ordinal-1)"
            fillOpacity={0.55}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke="var(--viz-series-1)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: 'var(--viz-series-1)' }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--viz-surface)' }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

function RangeTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as MonthRange
  return (
    <div className="vtip">
      <div className="vtip__title">
        {label} · {unit}
      </div>
      <div className="vtip__row">
        <span className="vtip__name">최고</span>
        <span className="vtip__val">{d.max ?? '-'}</span>
      </div>
      <div className="vtip__row">
        <span className="vtip__name">평균</span>
        <span className="vtip__val">{d.avg ?? '-'}</span>
      </div>
      <div className="vtip__row">
        <span className="vtip__name">최저</span>
        <span className="vtip__val">{d.min ?? '-'}</span>
      </div>
    </div>
  )
}

/* ==========================================================================
 *  2. PM10 ↔ PM2.5 상관 산점도
 *     두 항목이 함께 움직이면 같은 발생원(유입·정체), 흩어지면 서로 다른 원인.
 *
 *     설계(dataviz): 단일 계열이므로 범례 없음. 마커 지름 8px 이상,
 *     표면색 2px 링으로 겹침을 분리. 축은 각각 다른 변수이므로 산점도가 맞다.
 * ========================================================================*/
export function CorrelationScatter({
  points,
  r,
  n,
}: {
  points: { x: number; y: number; date: string }[]
  r: number | null
  n: number
}) {
  const strength =
    r === null ? '판정 불가' : Math.abs(r) >= 0.8 ? '매우 강함' : Math.abs(r) >= 0.6 ? '강함' : Math.abs(r) >= 0.4 ? '보통' : '약함'

  return (
    <ChartFrame
      title="PM10 · PM2.5 상관"
      sub={`일평균 ${n}일 · 상관계수 r = ${r ?? '-'} (${strength})`}
      note="점 하나가 하루입니다. 대각선에 가깝게 모일수록 두 항목이 같은 원인으로 함께 오르내린다는 뜻입니다."
      table={
        <table className="dtable">
          <thead>
            <tr>
              <th>날짜</th>
              <th>PM10</th>
              <th>PM2.5</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td className="num">{p.x}</td>
                <td className="num">{p.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={230}>
        <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -4 }}>
          <CartesianGrid stroke="var(--viz-grid)" />
          <XAxis
            type="number"
            dataKey="x"
            name="PM10"
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--viz-axis)' }}
            label={{
              value: 'PM10 (㎍/㎥)',
              position: 'insideBottom',
              offset: -4,
              fill: 'var(--viz-muted)',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="PM2.5"
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            label={{
              value: 'PM2.5 (㎍/㎥)',
              angle: -90,
              position: 'insideLeft',
              offset: 14,
              style: { textAnchor: 'middle' },
              fill: 'var(--viz-muted)',
              fontSize: 11,
            }}
          />
          <ZAxis range={[46, 46]} />
          <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--viz-axis)' }} />
          <Scatter
            data={points}
            fill="var(--viz-series-1)"
            fillOpacity={0.62}
            stroke="var(--viz-surface)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  return (
    <div className="vtip">
      <div className="vtip__title">{p.date}</div>
      <div className="vtip__row">
        <span className="vtip__name">PM10</span>
        <span className="vtip__val">{p.x} ㎍/㎥</span>
      </div>
      <div className="vtip__row">
        <span className="vtip__name">PM2.5</span>
        <span className="vtip__val">{p.y} ㎍/㎥</span>
      </div>
    </div>
  )
}

/* ==========================================================================
 *  3. 월별 등급 구성비 — 계절에 따라 '좋음'이 얼마나 줄어드는지
 *     설계(dataviz): 100% 스택, 세그먼트 사이 2px 표면 간격,
 *     의미는 하단 범례의 [기호 + 등급명]이 전달한다.
 * ========================================================================*/
export function MonthlyGradeMix({
  data,
}: {
  data: { label: string; total: number; segments: { grade: GradeLevel; days: number; pct: number }[] }[]
}) {
  return (
    <ChartFrame
      title="월별 등급 구성"
      sub="각 달의 일수를 100%로 본 등급 비율"
      note="계절에 따라 '좋음'의 비중이 어떻게 달라지는지 봅니다."
      legend={([1, 2, 3, 4] as GradeLevel[]).map((g) => ({
        label: GRADE_LABEL[g],
        color: GRADE_CSS_VAR[g],
        shape: 'square' as const,
      }))}
      table={
        <table className="dtable">
          <thead>
            <tr>
              <th>월</th>
              <th>좋음</th>
              <th>보통</th>
              <th>나쁨</th>
              <th>매우나쁨</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.label}>
                <td>{m.label}</td>
                {([1, 2, 3, 4] as GradeLevel[]).map((g) => (
                  <td className="num" key={g}>
                    {m.segments.find((s) => s.grade === g)?.days ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="mixgrid">
        {data.map((m) => (
          <div className="mixrow" key={m.label}>
            <span className="mixrow__label">{m.label}</span>
            <span
              className="mixrow__bar"
              role="img"
              aria-label={m.segments
                .map((s) => `${GRADE_LABEL[s.grade]} ${s.days}일`)
                .join(', ')}
            >
              {m.segments.map((s) => (
                <span
                  key={s.grade}
                  className="mixrow__seg"
                  style={{ width: `${s.pct}%`, background: GRADE_CSS_VAR[s.grade] }}
                  title={`${GRADE_ICON[s.grade]} ${GRADE_LABEL[s.grade]} ${s.days}일`}
                />
              ))}
            </span>
            <span className="mixrow__n">{m.total}일</span>
          </div>
        ))}
      </div>
    </ChartFrame>
  )
}

/* ==========================================================================
 *  4. 누적 초과일수 — 기준 초과가 기간 중 언제 몰렸는지
 * ========================================================================*/
export function CumulativeBadChart({
  data,
  pollutant,
}: {
  data: { label: string; value: number; hint: string }[]
  pollutant: Extract<Pollutant, 'pm10' | 'pm25'>
}) {
  return (
    <ChartFrame
      title="누적 '나쁨 이상' 일수"
      sub={`${POLLUTANT_SHORT[pollutant]} 기준 초과일의 누적`}
      note="선이 가파른 구간이 고농도가 몰린 시기입니다. 평평하면 그 기간에는 초과일이 없었다는 뜻입니다."
      table={
        <table className="dtable">
          <thead>
            <tr>
              <th>날짜</th>
              <th>누적 초과일</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.hint}>
                <td>{d.hint}</td>
                <td className="num">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--viz-axis)' }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--viz-axis)' }}
            content={({ active, payload }: any) =>
              active && payload?.length ? (
                <div className="vtip">
                  <div className="vtip__title">{payload[0].payload.hint}</div>
                  <div className="vtip__row">
                    <span className="vtip__name">누적 초과일</span>
                    <span className="vtip__val">{payload[0].value}일</span>
                  </div>
                </div>
              ) : null
            }
          />
          <Area
            type="stepAfter"
            dataKey="value"
            stroke="var(--grade-3)"
            strokeWidth={2}
            fill="var(--grade-3)"
            fillOpacity={0.14}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
