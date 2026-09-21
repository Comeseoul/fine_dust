import ChartFrame from './ChartFrame'
import { GRADE_CSS_VAR, GRADE_ICON, GRADE_LABEL, toGrade } from '../../lib/grade'
import type { Pollutant } from '../../lib/types'
import './charts.css'

export interface RankItem {
  name: string
  value: number | null
}

/**
 * 순위 막대 — 크기 비교가 목적이므로 길이 인코딩을 쓴다.
 *
 * 설계 근거(dataviz)
 *  · 막대는 0 에서 시작하고, 데이터 끝만 4px 라운드 처리한다.
 *  · 막대 색은 등급(status) 이므로 항상 값 라벨이 옆에 붙는다 — 색 단독 금지.
 *  · 항목이 많으므로 값 라벨은 전 항목에 직접 표기(가로 막대의 표준 형태).
 */
export default function RankBars({
  title,
  sub,
  items,
  pollutant,
  highlight,
  note,
  onSelect,
  max: maxProp,
}: {
  title: string
  sub?: string
  items: RankItem[]
  pollutant: Pollutant
  highlight?: string
  note?: string
  onSelect?: (name: string) => void
  max?: number
}) {
  const values = items.map((i) => i.value ?? 0)
  const max = maxProp ?? Math.max(1, ...values)

  return (
    <ChartFrame
      title={title}
      sub={sub}
      note={note}
      table={
        <table className="dtable">
          <thead>
            <tr>
              <th>지역</th>
              <th>농도(㎍/㎥)</th>
              <th>등급</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.name}>
                <td>{i.name}</td>
                <td className="num">{i.value ?? '-'}</td>
                <td>{GRADE_LABEL[toGrade(i.value, pollutant)]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="rank">
        {items.map((item, idx) => {
          const g = toGrade(item.value, pollutant)
          const pct = item.value === null ? 0 : Math.max(2, (item.value / max) * 100)
          const Row = onSelect ? 'button' : 'div'
          return (
            <Row
              key={item.name}
              className="rank__row"
              aria-current={highlight === item.name}
              onClick={onSelect ? () => onSelect(item.name) : undefined}
              type={onSelect ? 'button' : undefined}
            >
              <span className="rank__name">
                <span style={{ color: 'var(--text-disabled)', marginRight: 4 }}>{idx + 1}</span>
                {item.name}
              </span>
              <span className="rank__track">
                <span
                  className="rank__fill"
                  style={{ width: `${pct}%`, background: GRADE_CSS_VAR[g] }}
                />
              </span>
              <span className="rank__val">
                {item.value ?? '-'}
                <span
                  aria-hidden
                  style={{ marginLeft: 3, color: GRADE_CSS_VAR[g], fontSize: 10 }}
                  title={GRADE_LABEL[g]}
                >
                  {GRADE_ICON[g]}
                </span>
              </span>
            </Row>
          )
        })}
      </div>
    </ChartFrame>
  )
}
