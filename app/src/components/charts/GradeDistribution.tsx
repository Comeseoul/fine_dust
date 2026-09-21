import ChartFrame from './ChartFrame'
import { GRADE_CSS_VAR, GRADE_ICON, GRADE_LABEL } from '../../lib/grade'
import type { GradeLevel } from '../../lib/types'
import './charts.css'

export interface DistCount {
  grade: GradeLevel
  days: number
}

/**
 * 등급 일수 분포 — 전체 대비 구성비를 보는 100% 스택 막대.
 *
 * 설계 근거(dataviz)
 *  · 세그먼트 사이에 2px 표면 간격을 둬 인접 색이 맞닿지 않게 한다.
 *  · 각 세그먼트의 의미는 아래 라벨 목록이 [기호 + 등급명 + 일수] 로 직접 전달한다.
 *    (색은 보조 채널이며, 세그먼트가 좁아지면 색만으로는 읽히지 않기 때문)
 */
export default function GradeDistribution({
  title,
  sub,
  counts,
  note,
}: {
  title: string
  sub?: string
  counts: DistCount[]
  note?: string
}) {
  const total = counts.reduce((a, b) => a + b.days, 0)
  const visible = counts.filter((c) => c.days > 0)

  return (
    <ChartFrame
      title={title}
      sub={sub}
      note={note}
      table={
        <table className="dtable">
          <thead>
            <tr>
              <th>등급</th>
              <th>일수</th>
              <th>비율</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((c) => (
              <tr key={c.grade}>
                <td>{GRADE_LABEL[c.grade]}</td>
                <td className="num">{c.days}일</td>
                <td className="num">{total ? ((c.days / total) * 100).toFixed(1) : '0.0'}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {total === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 4px' }}>
          집계할 자료가 없습니다.
        </p>
      ) : (
        <>
          <div
            className="dist"
            role="img"
            aria-label={visible
              .map((c) => `${GRADE_LABEL[c.grade]} ${c.days}일`)
              .join(', ')}
          >
            {visible.map((c) => (
              <span
                key={c.grade}
                className="dist__seg"
                style={{
                  width: `${(c.days / total) * 100}%`,
                  background: GRADE_CSS_VAR[c.grade],
                }}
              />
            ))}
          </div>
          <div className="dist__labels">
            {counts.map((c) => (
              <span className="dist__label" key={c.grade}>
                <i style={{ background: GRADE_CSS_VAR[c.grade] }} aria-hidden />
                <span aria-hidden>{GRADE_ICON[c.grade]}</span>
                {GRADE_LABEL[c.grade]} <b>{c.days}일</b>
                <span style={{ color: 'var(--text-tertiary)' }}>
                  ({total ? Math.round((c.days / total) * 100) : 0}%)
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </ChartFrame>
  )
}
