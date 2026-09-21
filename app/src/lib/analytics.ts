/** ============================================================================
 *  통계 분석 계층
 *  일별 집계(DailyAggregate) 를 입력으로 받아 화면이 필요로 하는 지표를 만든다.
 *  결측은 '0' 이 아니라 '없는 값'으로 취급해 평균에서 제외한다.
 *  ==========================================================================*/

import { badThreshold, toGrade } from './grade'
import { changeRate, mean, maxOf, minOf } from './format'
import { parseYMD, weekdayKo } from './date'
import type { DailyAggregate, GradeLevel, Pollutant } from './types'

type PmKey = 'pm10' | 'pm25'

function valuesOf(days: DailyAggregate[], p: PmKey): (number | null)[] {
  return days.map((d) => (p === 'pm10' ? d.pm10Avg : d.pm25Avg))
}

export interface PeriodSummary {
  avg: number | null
  max: number | null
  min: number | null
  /** 나쁨 이상(기준 초과) 일수 */
  badDays: number
  /** 유효 관측일 수 */
  validDays: number
  /** 전체 일수 */
  totalDays: number
  /** 자료 수집률(%) */
  coverage: number
  /** 최고 농도를 기록한 날 */
  worstDate: string | null
}

export function summarize(days: DailyAggregate[], p: PmKey): PeriodSummary {
  const vals = valuesOf(days, p)
  const valid = days.filter((_, i) => vals[i] !== null)
  const threshold = badThreshold(p)
  const max = maxOf(vals)
  const worst = max === null ? null : (valid.find((d) => (p === 'pm10' ? d.pm10Avg : d.pm25Avg) === max)?.date ?? null)

  return {
    avg: mean(vals),
    max,
    min: minOf(vals),
    badDays: vals.filter((v): v is number => v !== null && v > threshold).length,
    validDays: valid.length,
    totalDays: days.length,
    coverage: days.length ? Math.round((valid.length / days.length) * 100) : 0,
    worstDate: worst,
  }
}

/** 등급별 일수 분포 */
export function gradeCounts(days: DailyAggregate[], p: PmKey): { grade: GradeLevel; days: number }[] {
  const counts: Record<GradeLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const v of valuesOf(days, p)) counts[toGrade(v, p as Pollutant)] += 1
  return ([1, 2, 3, 4, 0] as GradeLevel[])
    .filter((g) => g !== 0 || counts[0] > 0)
    .map((g) => ({ grade: g, days: counts[g] }))
}

/** 요일별 평균 — 생활 패턴과의 연결점을 찾기 위한 지표 */
export function weekdayAverages(days: DailyAggregate[], p: PmKey): { label: string; value: number | null }[] {
  const buckets: (number | null)[][] = Array.from({ length: 7 }, () => [])
  for (const d of days) {
    const v = p === 'pm10' ? d.pm10Avg : d.pm25Avg
    buckets[parseYMD(d.date).getDay()].push(v)
  }
  return buckets.map((b, i) => ({
    label: ['일', '월', '화', '수', '목', '금', '토'][i],
    value: mean(b) === null ? null : Math.round(mean(b)!),
  }))
}

/** 월별 평균 — 12개월 구간에서 계절성을 본다 */
export function monthlyAverages(days: DailyAggregate[], p: PmKey): { label: string; value: number | null }[] {
  const bucket = new Map<string, (number | null)[]>()
  for (const d of days) {
    const ym = d.date.slice(0, 7)
    if (!bucket.has(ym)) bucket.set(ym, [])
    bucket.get(ym)!.push(p === 'pm10' ? d.pm10Avg : d.pm25Avg)
  }
  return [...bucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, vals]) => {
      const m = mean(vals)
      return { label: `${Number(ym.slice(5, 7))}월`, value: m === null ? null : Math.round(m) }
    })
}

/** 직전 동일 길이 구간과의 비교 */
export interface PeriodComparison {
  current: number | null
  previous: number | null
  changePct: number | null
}

export function compareWithPrevious(
  current: DailyAggregate[],
  previous: DailyAggregate[],
  p: PmKey,
): PeriodComparison {
  const cur = mean(valuesOf(current, p))
  const prev = mean(valuesOf(previous, p))
  return { current: cur, previous: prev, changePct: changeRate(cur, prev) }
}

/** 7일 이동평균 — 단기 변동을 걷어내고 추세를 본다 */
export function movingAverage(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    const m = mean(slice)
    return m === null ? null : Math.round(m * 10) / 10
  })
}

/** 연속 초과일 중 가장 긴 구간 */
export function longestBadStreak(days: DailyAggregate[], p: PmKey): { length: number; from: string | null; to: string | null } {
  const threshold = badThreshold(p)
  let best = { length: 0, from: null as string | null, to: null as string | null }
  let cur = 0
  let start: string | null = null

  for (const d of days) {
    const v = p === 'pm10' ? d.pm10Avg : d.pm25Avg
    if (v !== null && v > threshold) {
      if (cur === 0) start = d.date
      cur += 1
      if (cur > best.length) best = { length: cur, from: start, to: d.date }
    } else {
      cur = 0
      start = null
    }
  }
  return best
}

/* -------------------------------------------------------------------------- */
/*  자동 인사이트 문장 생성                                                     */
/* -------------------------------------------------------------------------- */

export interface Insight {
  tone: 'good' | 'bad' | 'neutral'
  text: string
}

/**
 * 계산된 지표를 한국어 문장으로 바꾼다.
 * 숫자만 늘어놓는 대신 '무엇을 읽어야 하는지'를 함께 제시하는 것이 목적이며,
 * 모든 문장은 위 함수들이 낸 값에서만 만들어진다(추정·과장 없음).
 */
export function buildInsights(
  days: DailyAggregate[],
  p: PmKey,
  summary: PeriodSummary,
  comparison: PeriodComparison,
  label: string,
): Insight[] {
  const out: Insight[] = []
  const unit = '㎍/㎥'
  const name = p === 'pm10' ? '미세먼지' : '초미세먼지'

  if (summary.avg !== null) {
    const g = toGrade(summary.avg, p as Pollutant)
    out.push({
      tone: g >= 3 ? 'bad' : g <= 1 ? 'good' : 'neutral',
      text: `${label} 기간 ${name} 평균은 **${Math.round(summary.avg)}${unit}**로, 일평균 기준 **${['자료없음', '좋음', '보통', '나쁨', '매우나쁨'][g]}** 수준이었어요.`,
    })
  }

  if (comparison.changePct !== null) {
    const up = comparison.changePct > 0
    out.push({
      tone: up ? 'bad' : 'good',
      text: `직전 같은 길이의 기간과 비교하면 **${Math.abs(comparison.changePct).toFixed(1)}% ${up ? '높아졌' : '낮아졌'}어요.** (${Math.round(comparison.previous ?? 0)} → ${Math.round(comparison.current ?? 0)}${unit})`,
    })
  }

  if (summary.badDays > 0 && summary.validDays > 0) {
    const pct = Math.round((summary.badDays / summary.validDays) * 100)
    out.push({
      tone: pct >= 20 ? 'bad' : 'neutral',
      text: `관측된 ${summary.validDays}일 중 **${summary.badDays}일(${pct}%)** 이 '나쁨' 이상이었어요.`,
    })
  } else if (summary.validDays > 0) {
    out.push({
      tone: 'good',
      text: `이 기간에는 '나쁨' 이상인 날이 **한 번도 없었어요.**`,
    })
  }

  const streak = longestBadStreak(days, p)
  if (streak.length >= 2) {
    out.push({
      tone: 'bad',
      text: `**${streak.from} ~ ${streak.to}** 에 ${streak.length}일 연속으로 기준을 넘었어요. 대기 정체가 이어진 구간으로 볼 수 있어요.`,
    })
  }

  if (summary.worstDate && summary.max !== null) {
    const d = parseYMD(summary.worstDate)
    out.push({
      tone: 'neutral',
      text: `가장 높았던 날은 **${summary.worstDate}(${weekdayKo(d)})**, ${Math.round(summary.max)}${unit} 였어요.`,
    })
  }

  const wd = weekdayAverages(days, p).filter((w) => w.value !== null)
  if (wd.length === 7) {
    const sorted = [...wd].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    const gap = (sorted[0].value ?? 0) - (sorted[6].value ?? 0)
    if (gap >= 5) {
      out.push({
        tone: 'neutral',
        text: `요일로 보면 **${sorted[0].label}요일이 가장 높고(${sorted[0].value}${unit}) ${sorted[6].label}요일이 가장 낮았어요(${sorted[6].value}${unit}).**`,
      })
    }
  }

  if (summary.coverage < 90 && summary.totalDays > 0) {
    out.push({
      tone: 'neutral',
      text: `이 기간 자료 수집률은 **${summary.coverage}%** 예요. 결측일은 평균 계산에서 제외했습니다.`,
    })
  }

  return out
}

/** **강조** 마크업을 React 없이 토큰 배열로 분해 */
export function splitEmphasis(text: string): { text: string; strong: boolean }[] {
  return text.split(/\*\*/).map((chunk, i) => ({ text: chunk, strong: i % 2 === 1 }))
}

/* ==========================================================================
 *  확장 분석 — 데스크톱 대시보드용 지표
 *  (모바일에서는 공간 제약으로 일부만 노출한다)
 * ========================================================================*/

/** 시간대별 평균 프로필 — 하루 중 언제 나쁜지 */
export function hourlyProfile(
  obs: { at: string; pm10?: number | null; pm25?: number | null }[],
) {
  const buckets: { pm10: (number | null)[]; pm25: (number | null)[] }[] = Array.from(
    { length: 24 },
    () => ({ pm10: [], pm25: [] }),
  )
  for (const o of obs) {
    const h = new Date(o.at).getHours()
    buckets[h].pm10.push(o.pm10 ?? null)
    buckets[h].pm25.push(o.pm25 ?? null)
  }
  return buckets.map((b, h) => {
    const a = mean(b.pm10)
    const c = mean(b.pm25)
    return {
      label: `${h}시`,
      pm10: a === null ? null : Math.round(a),
      pm25: c === null ? null : Math.round(c),
      hint: `${h}시 평균`,
    }
  })
}

/** 월별 최소~최대 범위 + 평균 — 계절별 변동폭 */
export interface MonthRange {
  label: string
  min: number | null
  avg: number | null
  max: number | null
  /** 면적 차트용: min 을 바닥으로 한 높이 */
  span: number | null
}

export function monthlyRanges(days: DailyAggregate[], p: PmKey): MonthRange[] {
  const bucket = new Map<string, (number | null)[]>()
  for (const d of days) {
    const ym = d.date.slice(0, 7)
    if (!bucket.has(ym)) bucket.set(ym, [])
    bucket.get(ym)!.push(p === 'pm10' ? d.pm10Avg : d.pm25Avg)
  }
  return [...bucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, vals]) => {
      const lo = minOf(vals)
      const hi = maxOf(vals)
      const av = mean(vals)
      return {
        label: `${Number(ym.slice(5, 7))}월`,
        min: lo === null ? null : Math.round(lo),
        avg: av === null ? null : Math.round(av),
        max: hi === null ? null : Math.round(hi),
        span: lo === null || hi === null ? null : Math.round(hi - lo),
      }
    })
}

/** PM10 대비 PM2.5 비율 — 높을수록 2차 생성 미세먼지 비중이 큼 */
export function pm25Ratio(days: DailyAggregate[]): { label: string; ratio: number | null; hint: string }[] {
  return days.map((d) => ({
    label: d.date.slice(5).replace('-', '/'),
    ratio:
      d.pm10Avg === null || d.pm25Avg === null || d.pm10Avg === 0
        ? null
        : Math.round((d.pm25Avg / d.pm10Avg) * 100),
    hint: d.date,
  }))
}

/** 피어슨 상관계수 — PM10과 PM2.5가 함께 움직이는 정도 */
export function correlation(days: DailyAggregate[]): { r: number | null; n: number } {
  const pairs = days
    .filter((d) => d.pm10Avg !== null && d.pm25Avg !== null)
    .map((d) => [d.pm10Avg!, d.pm25Avg!] as const)
  const n = pairs.length
  if (n < 3) return { r: null, n }

  const mx = pairs.reduce((s, [x]) => s + x, 0) / n
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my)
    dx += (x - mx) ** 2
    dy += (y - my) ** 2
  }
  const den = Math.sqrt(dx * dy)
  return { r: den === 0 ? null : Math.round((num / den) * 1000) / 1000, n }
}

/** 산점도용 좌표 (PM10 x축, PM2.5 y축) */
export function scatterPoints(days: DailyAggregate[]) {
  return days
    .filter((d) => d.pm10Avg !== null && d.pm25Avg !== null)
    .map((d) => ({ x: d.pm10Avg!, y: d.pm25Avg!, date: d.date }))
}

/** 누적 초과일수 추이 — 기준 초과가 언제 몰렸는지 */
export function cumulativeBadDays(days: DailyAggregate[], p: PmKey) {
  const threshold = badThreshold(p)
  let acc = 0
  return days.map((d) => {
    const v = p === 'pm10' ? d.pm10Avg : d.pm25Avg
    if (v !== null && v > threshold) acc += 1
    return { label: d.date.slice(5).replace('-', '/'), value: acc, hint: d.date }
  })
}

/** 월별 등급 구성비 — 계절에 따라 등급 분포가 어떻게 달라지는지 */
export function monthlyGradeMix(days: DailyAggregate[], p: PmKey) {
  const bucket = new Map<string, DailyAggregate[]>()
  for (const d of days) {
    const ym = d.date.slice(0, 7)
    if (!bucket.has(ym)) bucket.set(ym, [])
    bucket.get(ym)!.push(d)
  }
  return [...bucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, list]) => {
      const counts: Record<GradeLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
      for (const d of list) counts[toGrade(p === 'pm10' ? d.pm10Avg : d.pm25Avg, p as Pollutant)] += 1
      const total = list.length || 1
      return {
        label: `${Number(ym.slice(5, 7))}월`,
        total: list.length,
        segments: ([1, 2, 3, 4, 0] as GradeLevel[])
          .filter((g) => counts[g] > 0)
          .map((g) => ({ grade: g, days: counts[g], pct: (counts[g] / total) * 100 })),
      }
    })
}
