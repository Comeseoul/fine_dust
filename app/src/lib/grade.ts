import type { GradeLevel, Pollutant } from './types'

/**
 * 환경부 대기환경기준 4단계 구분 (24시간 평균 기준).
 * 출처: 「환경정책기본법 시행령」 별표1 및 에어코리아 통합대기환경지수 구간.
 *   PM10  (㎍/㎥) : 0~30 / 31~80 / 81~150 / 151~
 *   PM2.5 (㎍/㎥) : 0~15 / 16~35 / 36~75  / 76~
 */
const BREAKPOINTS: Record<Pollutant, [number, number, number]> = {
  pm10: [30, 80, 150],
  pm25: [15, 35, 75],
  o3: [0.03, 0.09, 0.15],
  no2: [0.03, 0.06, 0.2],
  co: [2, 9, 15],
  so2: [0.02, 0.05, 0.15],
  khai: [50, 100, 250],
}

export const GRADE_LABEL: Record<GradeLevel, string> = {
  0: '자료없음',
  1: '좋음',
  2: '보통',
  3: '나쁨',
  4: '매우나쁨',
}

/** 등급별 기호 — 색에 의존하지 않는 2차 인코딩 채널 */
export const GRADE_ICON: Record<GradeLevel, string> = {
  0: '—',
  1: '☺',
  2: '☁',
  3: '⚠',
  4: '☠',
}

/** 등급별 한 줄 행동요령 */
export const GRADE_ADVICE: Record<GradeLevel, string> = {
  0: '측정 자료가 없어요. 잠시 후 다시 확인해 주세요.',
  1: '야외 활동하기 좋은 날이에요.',
  2: '평소처럼 활동해도 괜찮아요.',
  3: '민감군은 실외 활동을 줄이는 게 좋아요.',
  4: '가급적 실외 활동을 피하고 마스크를 착용하세요.',
}

export const GRADE_CSS_VAR: Record<GradeLevel, string> = {
  0: 'var(--grade-0)',
  1: 'var(--grade-1)',
  2: 'var(--grade-2)',
  3: 'var(--grade-3)',
  4: 'var(--grade-4)',
}

export const GRADE_BG_VAR: Record<GradeLevel, string> = {
  0: 'var(--grade-0-bg)',
  1: 'var(--grade-1-bg)',
  2: 'var(--grade-2-bg)',
  3: 'var(--grade-3-bg)',
  4: 'var(--grade-4-bg)',
}

/** 농도값 → 등급. 값이 없거나 음수(결측 코드)면 0(자료없음). */
export function toGrade(value: number | null | undefined, p: Pollutant): GradeLevel {
  if (value === null || value === undefined || Number.isNaN(value) || value < 0) return 0
  const [a, b, c] = BREAKPOINTS[p]
  if (value <= a) return 1
  if (value <= b) return 2
  if (value <= c) return 3
  return 4
}

/** 두 항목 중 더 나쁜 등급 (대표 등급 산출용) */
export function worseGrade(a: GradeLevel, b: GradeLevel): GradeLevel {
  if (a === 0) return b
  if (b === 0) return a
  return (a > b ? a : b) as GradeLevel
}

export const POLLUTANT_LABEL: Record<Pollutant, string> = {
  pm10: '미세먼지',
  pm25: '초미세먼지',
  o3: '오존',
  no2: '이산화질소',
  co: '일산화탄소',
  so2: '아황산가스',
  khai: '통합대기환경지수',
}

export const POLLUTANT_SHORT: Record<Pollutant, string> = {
  pm10: 'PM10',
  pm25: 'PM2.5',
  o3: 'O₃',
  no2: 'NO₂',
  co: 'CO',
  so2: 'SO₂',
  khai: 'CAI',
}

export const POLLUTANT_UNIT: Record<Pollutant, string> = {
  pm10: '㎍/㎥',
  pm25: '㎍/㎥',
  o3: 'ppm',
  no2: 'ppm',
  co: 'ppm',
  so2: 'ppm',
  khai: '',
}

/** 항목별 소수 자릿수 */
export const POLLUTANT_DIGITS: Record<Pollutant, number> = {
  pm10: 0, pm25: 0, o3: 3, no2: 3, co: 1, so2: 3, khai: 0,
}

/** 기준 초과일 판정에 쓰는 '나쁨 이상' 임계값 */
export function badThreshold(p: Pollutant): number {
  return BREAKPOINTS[p][1]
}

export function breakpointsOf(p: Pollutant): [number, number, number] {
  return BREAKPOINTS[p]
}
