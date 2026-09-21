/** 날짜 유틸 — 모든 계산은 KST(Asia/Seoul) 기준으로 취급한다.
 *  에어코리아 원자료의 dataTime 은 'YYYY-MM-DD HH:mm' (KST) 형식이며,
 *  24시 표기(예: '2026-09-20 24:00')가 내려오는 경우가 있어 보정한다. */

const pad = (n: number) => String(n).padStart(2, '0')

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toYM(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 에어코리아 dataTime 파싱. '24:00' → 다음날 '00:00' 으로 정규화 */
export function parseDataTime(raw: string | undefined | null): Date | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const hour = Number(h)
  const base = new Date(Number(y), Number(mo) - 1, Number(d), 0, Number(mi))
  base.setHours(base.getHours() + hour)
  return base
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function daysBetween(a: Date, b: Date): number {
  const ms = parseYMD(toYMD(b)).getTime() - parseYMD(toYMD(a)).getTime()
  return Math.round(ms / 86_400_000)
}

/** [from, to] 구간의 모든 날짜를 YYYY-MM-DD 로 나열 */
export function eachDay(from: Date, to: Date): string[] {
  const out: string[] = []
  let cur = parseYMD(toYMD(from))
  const end = parseYMD(toYMD(to))
  while (cur <= end) {
    out.push(toYMD(cur))
    cur = addDays(cur, 1)
  }
  return out
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

export function weekdayKo(d: Date): string {
  return WEEKDAY[d.getDay()]
}

/** '9월 21일 (월)' */
export function formatDateKo(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdayKo(d)})`
}

/** '9.21 14:00' */
export function formatDateTimeShort(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 'n분 전' / 'n시간 전' */
export function timeAgo(d: Date, now = new Date()): string {
  const diff = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000))
  if (diff < 1) return '방금 전'
  if (diff < 60) return `${diff}분 전`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

/** API 파라미터용 YYYYMMDD */
export function toCompact(d: Date): string {
  return toYMD(d).replace(/-/g, '')
}
