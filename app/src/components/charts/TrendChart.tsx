import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartFrame from './ChartFrame'
import { POLLUTANT_SHORT, breakpointsOf } from '../../lib/grade'
import './charts.css'

export interface TrendPoint {
  /** x축 라벨 */
  label: string
  pm10: number | null
  pm25: number | null
  /** 툴팁 보조 텍스트 */
  hint?: string
}

const C1 = 'var(--viz-series-1)'
const C2 = 'var(--viz-series-2)'

/**
 * 시계열 추이 — 선형 차트.
 *
 * 설계 근거(dataviz)
 *  · PM10 / PM2.5 는 단위(㎍/㎥)가 같으므로 축은 하나만 쓴다. 이중축 금지.
 *  · 선 굵기 2px, 마커는 hover 시에만 r=4(지름 8px) 로 노출.
 *  · 격자는 가로선만, hairline 으로 후퇴시킨다.
 *  · '나쁨' 기준선(PM10 80 / PM2.5 35)을 참조선으로 깔아 수치의 의미를 준다.
 */
export default function TrendChart({
  title,
  sub,
  data,
  note,
  height = 200,
  showThreshold = true,
  tableRows,
}: {
  title: string
  sub?: string
  data: TrendPoint[]
  note?: string
  height?: number
  showThreshold?: boolean
  tableRows?: React.ReactNode
}) {
  const pm10Bad = breakpointsOf('pm10')[1]
  const pm25Bad = breakpointsOf('pm25')[1]

  // 기준선이 데이터 범위에서 너무 멀면 축이 늘어나 실제 변동이 눌린다.
  // 관측 최댓값이 기준의 60% 이상일 때만 해당 기준선을 그린다.
  const peak = Math.max(
    0,
    ...data.flatMap((d) => [d.pm10 ?? 0, d.pm25 ?? 0]),
  )
  const showPm10Line = showThreshold && peak >= pm10Bad * 0.6
  const showPm25Line = showThreshold && peak >= pm25Bad * 0.6

  return (
    <ChartFrame
      title={title}
      sub={sub}
      note={note}
      legend={[
        { label: `${POLLUTANT_SHORT.pm10} 미세먼지`, color: C1 },
        { label: `${POLLUTANT_SHORT.pm25} 초미세먼지`, color: C2 },
      ]}
      table={tableRows}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
          <CartesianGrid
            stroke="var(--viz-grid)"
            strokeWidth={1}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--viz-axis)' }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
          />

          {showPm10Line && (
            <ReferenceLine
                y={pm10Bad}
                stroke="var(--viz-series-1)"
                strokeDasharray="3 4"
                strokeOpacity={0.45}
                label={{
                  value: `PM10 나쁨 ${pm10Bad}`,
                  position: 'insideTopRight',
                  fill: 'var(--viz-muted)',
                  fontSize: 10,
                }}
              />
          )}
          {showPm25Line && (
            <ReferenceLine
              y={pm25Bad}
              stroke="var(--viz-series-2)"
              strokeDasharray="3 4"
              strokeOpacity={0.45}
              label={{
                value: `PM2.5 나쁨 ${pm25Bad}`,
                position: 'insideBottomRight',
                fill: 'var(--viz-muted)',
                fontSize: 10,
              }}
            />
          )}

          <Tooltip
            cursor={{ stroke: 'var(--viz-axis)', strokeWidth: 1 }}
            content={<TrendTooltip />}
          />

          <Line
            type="monotone"
            dataKey="pm10"
            name="PM10"
            stroke={C1}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--viz-surface)' }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="pm25"
            name="PM2.5"
            stroke={C2}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--viz-surface)' }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

interface TooltipPayload {
  active?: boolean
  label?: string
  payload?: { name: string; value: number | null; color: string; payload: TrendPoint }[]
}

function TrendTooltip({ active, label, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null
  const hint = payload[0]?.payload?.hint
  return (
    <div className="vtip">
      <div className="vtip__title">{hint ?? label}</div>
      {payload.map((p) => (
        <div className="vtip__row" key={p.name}>
          <span className="vtip__name">
            <span
              className="legend__swatch"
              style={{ background: p.color, width: 10, height: 3 }}
              aria-hidden
            />
            {p.name}
          </span>
          <span className="vtip__val">
            {p.value === null || p.value === undefined ? '결측' : `${p.value} ㎍/㎥`}
          </span>
        </div>
      ))}
    </div>
  )
}
