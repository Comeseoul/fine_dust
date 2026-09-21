import { NavLink, Outlet, useLocation } from 'react-router-dom'
import './shell.css'

const TABS = [
  { to: '/', label: '현황', desc: '실시간 측정', icon: HomeIcon, end: true },
  { to: '/stats', label: '통계', desc: '기간별 분석', icon: ChartIcon },
  { to: '/history', label: '이력', desc: '원자료 조회', icon: HistoryIcon },
  { to: '/report', label: '리포트', desc: '문서 출력', icon: ReportIcon },
  { to: '/settings', label: '설정', desc: '표시·연결', icon: GearIcon },
]

export default function AppShell() {
  const { pathname } = useLocation()

  return (
    <div className="shell">
      {/* 데스크톱(≥1280px)에서만 보이는 사이드 내비 */}
      <nav className="sidenav no-print" aria-label="주요 화면">
        <div className="sidenav__brand">
          <span className="sidenav__logo" aria-hidden>
            먼
          </span>
          <span>
            <span className="sidenav__name">미세먼지 인사이트</span>
            <span className="sidenav__tag" style={{ display: 'block' }}>
              에어코리아 공공데이터
            </span>
          </span>
        </div>

        {TABS.map(({ to, label, desc, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="sidenav__item">
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span>
                  {label}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      marginTop: -2,
                    }}
                  >
                    {desc}
                  </span>
                </span>
              </>
            )}
          </NavLink>
        ))}

        <p className="sidenav__foot">
          자료 출처 한국환경공단 에어코리아
          <br />
          판정 기준 환경부 대기환경기준 4단계
        </p>
      </nav>

      <main className="shell__main" key={pathname}>
        <Outlet />
      </main>

      {/* 모바일·태블릿 하단 탭바 */}
      <nav className="tabbar no-print" aria-label="주요 화면">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__item">
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span className="tabbar__label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/* --- 아이콘 -------------------------------------------------------------
 * 활성 상태를 색이 아니라 '굵기'로도 구분한다. */
type IconProps = { active: boolean }
const base = (active: boolean) => ({
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: active ? 2.4 : 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  style: { flex: 'none' as const },
})

function HomeIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-7v6H5A1.5 1.5 0 0 1 3.5 19z" />
    </svg>
  )
}
function ChartIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />
    </svg>
  )
}
function HistoryIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}
function ReportIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  )
}
function GearIcon({ active }: IconProps) {
  return (
    <svg {...base(active)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 1 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 1 1 0-4h.11a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 1 1 4 0v.11a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9c.26.6.85.99 1.5 1H21a2 2 0 1 1 0 4h-.11a1.6 1.6 0 0 0-1.49.97z" />
    </svg>
  )
}
