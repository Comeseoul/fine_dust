import { splitEmphasis, type Insight } from '../../lib/analytics'

const MARK = {
  good: { bg: 'var(--grade-1)', char: '↓' },
  bad: { bg: 'var(--grade-4)', char: '↑' },
  neutral: { bg: 'var(--grey-500)', char: '·' },
} as const

/**
 * 자동 생성 인사이트.
 * 방향성(증가/감소/중립)을 색이 아니라 기호(↑ ↓ ·)로도 함께 전달한다.
 */
export default function InsightList({ items }: { items: Insight[] }) {
  if (items.length === 0) return null
  return (
    <ul>
      {items.map((it, i) => (
        <li className="insight" key={i}>
          <span className="insight__mark" style={{ background: MARK[it.tone].bg }} aria-hidden>
            {MARK[it.tone].char}
          </span>
          <p className="insight__text">
            {splitEmphasis(it.text).map((tk, j) =>
              tk.strong ? <b key={j}>{tk.text}</b> : <span key={j}>{tk.text}</span>,
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}
