import { POLLUTANT_DIGITS, POLLUTANT_UNIT } from './grade'
import type { Pollutant } from './types'

/** 결측(null/NaN/음수)은 '-' 로 표기한다. 0 으로 채우지 않는다. */
export function fmtValue(v: number | null | undefined, p: Pollutant): string {
  if (v === null || v === undefined || Number.isNaN(v) || v < 0) return '-'
  return v.toFixed(POLLUTANT_DIGITS[p])
}

export function unitOf(p: Pollutant): string {
  return POLLUTANT_UNIT[p]
}

export function fmtDelta(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '-'
  const s = Math.abs(v).toFixed(digits)
  if (v > 0) return `+${s}`
  if (v < 0) return `-${s}`
  return s
}

export function fmtPercent(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '-'
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

/** 평균 — 결측을 제외하고 계산하며, 유효값이 없으면 null */
export function mean(values: (number | null | undefined)[]): number | null {
  const ok = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v >= 0)
  if (ok.length === 0) return null
  return ok.reduce((a, b) => a + b, 0) / ok.length
}

export function maxOf(values: (number | null | undefined)[]): number | null {
  const ok = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v >= 0)
  if (ok.length === 0) return null
  return Math.max(...ok)
}

export function minOf(values: (number | null | undefined)[]): number | null {
  const ok = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v >= 0)
  if (ok.length === 0) return null
  return Math.min(...ok)
}

/** 변화율(%) — 기준값이 0이거나 결측이면 null */
export function changeRate(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null
  return ((cur - prev) / prev) * 100
}
