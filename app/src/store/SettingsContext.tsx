import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_SIDO } from '../lib/config'
import type { Pollutant } from '../lib/types'

export type ThemePref = 'system' | 'light' | 'dark'

interface Settings {
  sido: string
  station: string
  /** 기본으로 강조할 측정 항목 */
  pollutant: Extract<Pollutant, 'pm10' | 'pm25'>
  theme: ThemePref
  /** 색각 보조 모드 — 등급 4색을 단일 색상 순서형 램프로 치환 */
  cvdSafe: boolean
}

interface SettingsApi extends Settings {
  setSido: (v: string) => void
  setStation: (v: string) => void
  setPollutant: (v: 'pm10' | 'pm25') => void
  setTheme: (v: ThemePref) => void
  setCvdSafe: (v: boolean) => void
}

const STORAGE_KEY = 'dust-insight.settings.v1'

const DEFAULTS: Settings = {
  sido: DEFAULT_SIDO,
  station: '',
  pollutant: 'pm25',
  theme: 'system',
  cvdSafe: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULTS
  }
}

const Ctx = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 시크릿 모드 등에서 저장이 막혀도 앱 동작에는 영향이 없다 */
    }
  }, [state])

  // 테마 / 색각보조는 :root 속성으로 내려 CSS 토큰이 스스로 바뀌게 한다.
  useEffect(() => {
    const root = document.documentElement
    if (state.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', state.theme)
  }, [state.theme])

  useEffect(() => {
    const root = document.documentElement
    if (state.cvdSafe) root.setAttribute('data-cvd', 'on')
    else root.removeAttribute('data-cvd')
  }, [state.cvdSafe])

  const patch = useCallback(
    <K extends keyof Settings>(key: K) =>
      (value: Settings[K]) =>
        setState((s) => (s[key] === value ? s : { ...s, [key]: value })),
    [],
  )

  const value = useMemo<SettingsApi>(
    () => ({
      ...state,
      // 시도를 바꾸면 이전 측정소 선택은 무효가 되므로 함께 초기화한다.
      setSido: (v) => setState((s) => (s.sido === v ? s : { ...s, sido: v, station: '' })),
      setStation: patch('station'),
      setPollutant: patch('pollutant'),
      setTheme: patch('theme'),
      setCvdSafe: patch('cvdSafe'),
    }),
    [state, patch],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings must be used within <SettingsProvider>')
  return v
}
