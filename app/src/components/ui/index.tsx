import { useEffect, type ReactNode } from 'react'
import './ui.css'

/* ---- Card --------------------------------------------------------------- */
export function Card({
  children,
  variant,
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: 'flat' | 'tight' | 'bleed'
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const v = variant ? ` card--${variant}` : ''
  return (
    <div className={`card${v} ${className}`} {...rest}>
      {children}
    </div>
  )
}

/* ---- Section ------------------------------------------------------------ */
export function Section({
  title,
  desc,
  action,
  children,
}: {
  title: string
  desc?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h2 className="section__title">{title}</h2>
          {desc && <p className="section__desc">{desc}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/* ---- Button ------------------------------------------------------------- */
export function Button({
  children,
  variant = 'primary',
  block,
  size,
  ...rest
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  block?: boolean
  size?: 'sm'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    'btn',
    `btn--${variant}`,
    block ? 'btn--block' : '',
    size === 'sm' ? 'btn--sm' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

/* ---- Segmented control --------------------------------------------------
 * 탭이 아니라 '보기 전환' 컨트롤이므로 role=tablist 가 아닌 radiogroup 으로 둔다. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  block = true,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  block?: boolean
  label: string
}) {
  return (
    <div className={`seg${block ? ' seg--block' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          className="seg__item"
          role="radio"
          aria-checked={value === o.value}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---- Chip --------------------------------------------------------------- */
export function Chip({
  children,
  pressed,
  onClick,
}: {
  children: ReactNode
  pressed?: boolean
  onClick?: () => void
}) {
  return (
    <button className="chip" aria-pressed={!!pressed} onClick={onClick}>
      {children}
    </button>
  )
}

/* ---- Badge --------------------------------------------------------------
 * 색만으로 의미를 전달하지 않도록 반드시 텍스트를 함께 받는다. */
export function Badge({
  children,
  color,
  bg,
  dot,
}: {
  children: ReactNode
  color?: string
  bg?: string
  dot?: boolean
}) {
  return (
    <span className="badge" style={{ color, background: bg }}>
      {dot && <span className="badge__dot" style={{ background: color }} aria-hidden />}
      {children}
    </span>
  )
}

/* ---- List row ----------------------------------------------------------- */
export function ListRow({
  title,
  sub,
  right,
  onClick,
  chevron = true,
}: {
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  onClick?: () => void
  chevron?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className="listrow" onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="grow">
        <div className="listrow__title">{title}</div>
        {sub && <div className="listrow__sub">{sub}</div>}
      </div>
      {right}
      {onClick && chevron && (
        <span className="listrow__chev" aria-hidden>
          ›
        </span>
      )}
    </Tag>
  )
}

/* ---- Skeleton ----------------------------------------------------------- */
export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return (
    <div
      className="skel"
      style={{ height: h, width: w, borderRadius: r }}
      aria-hidden
    />
  )
}

/* ---- Empty / Error ------------------------------------------------------ */
export function StateBlock({
  icon,
  title,
  desc,
  action,
}: {
  icon?: string
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="state" role="status">
      {icon && (
        <div className="state__icon" aria-hidden>
          {icon}
        </div>
      )}
      <div className="state__title">{title}</div>
      {desc && <p className="state__desc">{desc}</p>}
      {action}
    </div>
  )
}

/* ---- Banner ------------------------------------------------------------- */
export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn'
  children: ReactNode
}) {
  return (
    <div className={`banner banner--${tone}`} role="status">
      <span className="banner__icon" aria-hidden>
        {tone === 'warn' ? '⚠' : 'ℹ'}
      </span>
      <span>{children}</span>
    </div>
  )
}

/* ---- Bottom sheet ------------------------------------------------------- */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <div className="sheet__scrim" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__handle" aria-hidden />
        <h2 className="sheet__title">{title}</h2>
        <div className="sheet__body">{children}</div>
      </div>
    </>
  )
}

/* ---- Stat tile ----------------------------------------------------------
 * 차트가 아니라 '단일 수치'가 답인 자리에 쓴다. (dataviz: choosing-a-form) */
export function Stat({
  label,
  value,
  unit,
  delta,
  deltaTone,
}: {
  label: string
  value: ReactNode
  unit?: string
  delta?: string
  deltaTone?: 'up' | 'down' | 'flat'
}) {
  const color =
    deltaTone === 'up' ? 'var(--negative)' : deltaTone === 'down' ? 'var(--positive)' : 'var(--text-tertiary)'
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </span>
      {delta && (
        <span className="stat__delta" style={{ color }}>
          {deltaTone === 'up' ? '▲' : deltaTone === 'down' ? '▼' : ''} {delta}
        </span>
      )}
    </div>
  )
}
