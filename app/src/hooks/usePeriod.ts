import { useMemo } from 'react'
import { addDays, addMonths, daysBetween, toYMD } from '../lib/date'

export type PeriodKey = '7d' | '30d' | '90d' | '12m'

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
  { value: '12m', label: '1년' },
]

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
  '12m': '최근 1년',
}

export interface Period {
  from: string
  to: string
  /** 직전 동일 길이 구간 — 증감 비교용 */
  prevFrom: string
  prevTo: string
  days: number
  label: string
}

/** 프리셋 → 실제 조회 구간. 기준일(어제)까지의 확정 자료를 본다. */
export function usePeriod(key: PeriodKey, now = new Date()): Period {
  return useMemo(() => {
    const to = addDays(now, -1) // 당일 자료는 확정 전이라 제외
    const from =
      key === '12m' ? addMonths(to, -12) : addDays(to, -(Number(key.replace('d', '')) - 1))

    const span = daysBetween(from, to) + 1
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -(span - 1))

    return {
      from: toYMD(from),
      to: toYMD(to),
      prevFrom: toYMD(prevFrom),
      prevTo: toYMD(prevTo),
      days: span,
      label: PERIOD_LABEL[key],
    }
    // now 는 렌더마다 새 객체이므로 날짜 문자열로 고정해 의존성을 안정화한다.
  }, [key, toYMD(now)])
}
