import { useId, useState, type ReactNode } from 'react'
import './charts.css'

export interface LegendEntry {
  label: string
  color: string
  shape?: 'line' | 'square'
}

/**
 * 모든 차트의 공통 껍데기.
 *  · 제목/설명/출처를 한곳에서 관리
 *  · 2계열 이상이면 범례를 강제 노출 (색 단독 식별 방지)
 *  · '표로 보기' 대체 뷰를 항상 제공 — 색각·대비 문제의 최종 안전장치
 */
export default function ChartFrame({
  title,
  sub,
  legend,
  note,
  table,
  children,
}: {
  title: string
  sub?: string
  legend?: LegendEntry[]
  note?: string
  /** 대체 표 뷰. 제공하면 우측 상단에 전환 버튼이 생긴다. */
  table?: ReactNode
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  const id = useId()

  return (
    <figure className="chartcard" style={{ margin: 0 }}>
      <div className="chartcard__head">
        <figcaption>
          <div className="chartcard__title" id={`${id}-t`}>
            {title}
          </div>
          {sub && <div className="chartcard__sub">{sub}</div>}
        </figcaption>
        {table && (
          <button
            className="chartcard__toggle no-print"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
          >
            {asTable ? '차트로' : '표로 보기'}
          </button>
        )}
      </div>

      <div className="chartcard__body" aria-labelledby={`${id}-t`}>
        {asTable && table ? <div className="tableview">{table}</div> : children}
      </div>

      {!asTable && legend && legend.length >= 2 && (
        <ul className="legend">
          {legend.map((l) => (
            <li key={l.label} className="legend__item">
              <span
                className={`legend__swatch${l.shape === 'square' ? ' legend__swatch--square' : ''}`}
                style={{ background: l.color }}
                aria-hidden
              />
              {l.label}
            </li>
          ))}
        </ul>
      )}

      {note && <div className="chartcard__foot">{note}</div>}
    </figure>
  )
}
