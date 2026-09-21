/** 결정론적 난수 — 같은 입력이면 항상 같은 값을 돌려준다.
 *  데모 데이터가 렌더링마다 달라지면 화면 검증이 불가능하므로
 *  (측정소, 날짜, 시각) 을 시드로 고정한다. */

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 PRNG */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededRandom(...parts: (string | number)[]): number {
  return rng(hashString(parts.join('|')))()
}

/** 평균 0, 표준편차 1 의 정규난수 (Box–Muller) */
export function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-9)
  const v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
