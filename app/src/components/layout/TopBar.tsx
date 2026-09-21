import type { ReactNode } from 'react'
import './shell.css'

export default function TopBar({
  title,
  sub,
  right,
  bordered,
}: {
  title: string
  sub?: ReactNode
  right?: ReactNode
  bordered?: boolean
}) {
  return (
    <header className={`topbar${bordered ? ' topbar--bordered' : ''} no-print`}>
      <div className="topbar__row">
        <div className="grow">
          <h1 className="topbar__title">{title}</h1>
          {sub && <div className="topbar__sub">{sub}</div>}
        </div>
        {right}
      </div>
    </header>
  )
}
