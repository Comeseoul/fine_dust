import { useMemo } from 'react'
import ChartFrame from './ChartFrame'
import { GRADE_LABEL, POLLUTANT_SHORT, toGrade } from '../../lib/grade'
import { parseYMD } from '../../lib/date'
import type { DailyAggregate, Pollutant } from '../../lib/types'
import './charts.css'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 연속 크기 → 단일 색상 램프 4단계 (dataviz sequential 규칙: 한 색상, 밝음→어두움) */
const RAMP = [
  'var(--viz-ordinal-1)',
  'var(--viz-ordinal-2)',
  'var(--viz-ordinal-3)',
  'var(--viz-ordinal-4)',
]

/**
 * 월간 캘린더 히트맵 — '언제 나빴는가'를 날짜 축 그대로 보여준다.
 *
 * 설계 근거(dataviz)
 *  · 연속 크기 인코딩이므로 무지개가 아니라 단일 색상(blue) 램프를 쓴다.
 *  · 셀 사이 2px 표면 간격(테두리)으로 인접 칸이 맞닿지 않게 한다.
 *  · 셀 안에 농도 숫자를 직접 표기해, 색을 못 읽어도 값이 전달되게 한다.
 */
export default function CalendarHeatmap({
  title,
  sub,
  days,
  pollutant,
  note,
  onSelect,
}: {
  title: string
  sub?: string
  days: DailyAggregate[]
  pollutant: Extract<Pollutant, 'pm10' | 'pm25'>
  note?: string
  onSelect?: (date: string) => void
}) {
  const key = pollutant === 'pm10' ? 'pm10Avg' : 'pm25Avg'

  const { cells, scale } = useMemo(() => {
    if (days.length === 0) return { cells: [], scale: [0, 0, 0] as number[] }

    const values = days
      .map((d) => d[key])
      .filter((v): v is number => v !== null && v >= 0)
      .sort((a, b) => a - b)

    // 분위수 기반 4구간 — 값 분포가 치우쳐도 색이 한쪽으로 몰리지 않는다.
    const q = (p: number) => values[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0
    const scale = [q(0.25), q(0.5), q(0.75)]

    const first = parseYMD(days[0].date)
    const lead = first.getDay()
    const cells: ({ d: DailyAggregate; bin: number } | null)[] = Array.from({ length: lead }, () => null)

    for (const d of days) {
      const v = d[key]
      const bin =
        v === null ? -1 : v <= scale[0] ? 0 : v <= scale[1] ? 1 : v <= scale[2] ? 2 : 3
      cells.push({ d, bin })
    }
    return { cells, scale }
  }, [days, key])

  return (
    <ChartFrame
      title={title}
      sub={sub}
      note={note ?? `색이 진할수록 농도가 높습니다. 구간 기준 ${scale.map((s) => Math.round(s)).join(' / ')} ㎍/㎥`}
      table={
        <table className="dtable">
          <thead>
            <tr>
              <th>날짜</th>
              <th>{POLLUTANT_SHORT[pollutant]}(㎍/㎥)</th>
              <th>등급</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td className="num">{d[key] ?? '-'}</td>
                <td>{GRADE_LABEL[toGrade(d[key], pollutant)]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="cal">
        <div className="cal__weekhead" aria-hidden>
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="cal__grid">
          {cells.map((c, i) => {
            if (!c) return <span key={`e${i}`} className="cal__cell cal__cell--empty" />
            const v = c.d[key]
            const day = parseYMD(c.d.date).getDate()
            if (v === null) {
              return (
                <span
                  key={c.d.date}
                  className="cal__cell cal__cell--nodata"
                  title={`${c.d.date} 자료없음`}
                >
                  {day}
                </span>
              )
            }
            const dark = c.bin >= 2
            const Cell = onSelect ? 'button' : 'span'
            return (
              <Cell
                key={c.d.date}
                className="cal__cell"
                style={{
                  background: RAMP[c.bin],
                  color: dark ? 'var(--viz-ink-on-fill)' : 'var(--viz-ink)',
                }}
                title={`${c.d.date} · ${POLLUTANT_SHORT[pollutant]} ${v}㎍/㎥ · ${GRADE_LABEL[toGrade(v, pollutant)]}`}
                onClick={onSelect ? () => onSelect(c.d.date) : undefined}
                type={onSelect ? 'button' : undefined}
              >
                {v}
              </Cell>
            )
          })}
        </div>
        <div className="cal__scale">
          <span>낮음</span>
          {RAMP.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
          <span>높음</span>
          <i style={{ background: 'var(--bg-ghost)', marginLeft: 6 }} />
          <span>자료없음</span>
        </div>
      </div>
    </ChartFrame>
  )
}
