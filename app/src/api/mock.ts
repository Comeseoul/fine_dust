/** ============================================================================
 *  데모 데이터 생성기
 *  인증키가 없어도 앱 전 기능을 시연할 수 있도록, 실제 관측 특성을 모사한
 *  합성 데이터를 만든다. 모든 값은 (측정소, 날짜, 시각) 시드로 고정되어
 *  새로고침해도 동일하다.
 *
 *  반영한 실제 패턴
 *   - 계절성   : 12~3월 고농도(난방/황사), 7~9월 저농도(강수/해양성기단)
 *   - 일주기   : 08~10시 / 19~21시 피크, 새벽 저점
 *   - 요일효과 : 주말 교통량 감소로 소폭 하락
 *   - 지역차   : 수도권/충청 내륙 높음, 제주/강원 낮음
 *   - 고농도 에피소드 : 수일간 지속되는 대기정체 사례를 확률적으로 삽입
 *   - 결측     : 약 1.5% 확률로 통신/점검 결측
 *  ==========================================================================*/

import { gauss, hashString, rng, seededRandom } from '../lib/seed'
import { addDays, eachDay, parseYMD, toYMD } from '../lib/date'
import { SIDO_LIST } from '../lib/config'
import type { DailyAggregate, Forecast, Observation, SidoSummary, Station } from '../lib/types'

/** 시도별 기저 농도 배수 (연평균 상대비 참고) */
const SIDO_FACTOR: Record<string, number> = {
  서울: 1.06, 부산: 0.94, 대구: 0.98, 인천: 1.08, 광주: 0.93,
  대전: 0.97, 울산: 0.95, 세종: 1.04, 경기: 1.1, 강원: 0.88,
  충북: 1.12, 충남: 1.07, 전북: 1.05, 전남: 0.9, 경북: 0.96,
  경남: 0.92, 제주: 0.78,
}

/** 시도별 대표 측정소 (데모용) */
const STATIONS: Record<string, string[]> = {
  서울: ['종로구', '중구', '강남구', '송파구', '마포구', '노원구', '구로구', '광진구'],
  부산: ['광복동', '연산동', '해운대구', '사상구', '동래구'],
  대구: ['수성구', '중구', '달서구', '북구'],
  인천: ['부평구', '연수구', '남동구', '계양구', '중구'],
  광주: ['서석동', '농성동', '두암동', '광산구'],
  대전: ['둔산동', '문화동', '읍내동', '정림동'],
  울산: ['신정동', '삼산동', '야음동', '부곡동'],
  세종: ['신흥동', '아름동', '보람동'],
  경기: ['수원', '성남', '고양', '용인', '부천', '안산', '평택', '의정부'],
  강원: ['춘천', '원주', '강릉', '속초', '태백'],
  충북: ['청주', '충주', '제천', '음성'],
  충남: ['천안', '아산', '서산', '당진', '보령'],
  전북: ['전주', '익산', '군산', '정읍'],
  전남: ['여수', '순천', '목포', '광양'],
  경북: ['포항', '구미', '경주', '안동'],
  경남: ['창원', '진주', '김해', '거제', '양산'],
  제주: ['제주시', '서귀포시', '이도동'],
}

/** 월별 계절 배수 (1~12월) */
const MONTH_FACTOR = [1.32, 1.38, 1.45, 1.12, 0.96, 0.82, 0.68, 0.7, 0.78, 0.94, 1.16, 1.28]

/** 시각별 일주기 배수 (0~23시) */
const HOUR_FACTOR = [
  0.84, 0.8, 0.78, 0.77, 0.79, 0.85, 0.95, 1.08, 1.18, 1.16, 1.08, 1.02,
  0.98, 0.95, 0.94, 0.96, 1.0, 1.06, 1.12, 1.15, 1.13, 1.06, 0.98, 0.9,
]

/** 고농도 에피소드 가중치 — 3~5일 지속되는 대기정체 사례 */
function episodeBoost(sido: string, date: Date): number {
  let boost = 0
  for (let back = 0; back < 5; back++) {
    const d = addDays(date, -back)
    const month = d.getMonth()
    const seasonal = month <= 3 || month >= 10 ? 0.055 : 0.018
    if (seededRandom('episode', sido, toYMD(d)) < seasonal) {
      const len = 3 + Math.floor(seededRandom('epilen', sido, toYMD(d)) * 3)
      if (back < len) boost = Math.max(boost, (1 - back / len) * 1.5)
    }
  }
  return boost
}

function basePm10(sido: string, station: string, date: Date, hour: number): number {
  const r = rng(hashString([sido, station, toYMD(date), hour].join('|')))
  const month = date.getMonth()
  const weekend = date.getDay() === 0 || date.getDay() === 6

  const stationBias = 0.88 + seededRandom('station', station) * 0.3
  const dayNoise = 1 + gauss(rng(hashString(['day', sido, station, toYMD(date)].join('|')))) * 0.26
  const hourNoise = 1 + gauss(r) * 0.12

  let v =
    34 *
    (SIDO_FACTOR[sido] ?? 1) *
    MONTH_FACTOR[month] *
    HOUR_FACTOR[hour] *
    stationBias *
    Math.max(0.35, dayNoise) *
    Math.max(0.55, hourNoise) *
    (weekend ? 0.93 : 1)

  v *= 1 + episodeBoost(sido, date)
  return Math.max(3, Math.round(v))
}

/** PM2.5 는 PM10 과 강한 상관을 가지되 비율이 계절에 따라 변한다 */
function derivePm25(pm10: number, sido: string, station: string, date: Date, hour: number): number {
  const month = date.getMonth()
  const winterRatio = month <= 2 || month >= 10 ? 0.62 : 0.46
  const r = rng(hashString(['p25', sido, station, toYMD(date), hour].join('|')))
  const ratio = winterRatio * (1 + gauss(r) * 0.14)
  return Math.max(2, Math.round(pm10 * Math.min(0.85, Math.max(0.28, ratio))))
}

function isMissing(station: string, date: Date, hour: number): boolean {
  return seededRandom('miss', station, toYMD(date), hour) < 0.015
}

export function mockStations(sido?: string): Station[] {
  const targets = sido ? [sido] : [...SIDO_LIST]
  const out: Station[] = []
  for (const s of targets) {
    for (const name of STATIONS[s] ?? []) {
      out.push({
        stationName: name,
        sidoName: s,
        addr: s + ' ' + name + ' 일대',
        mangName: seededRandom('mang', s, name) < 0.25 ? '도로변대기' : '도시대기',
        year: '2016',
      })
    }
  }
  return out
}

/** 특정 측정소의 시간별 관측 (과거 hours 시간, 오름차순) */
export function mockHourly(sido: string, station: string, hours: number, now = new Date()): Observation[] {
  const out: Observation[] = []
  const cursor = new Date(now)
  cursor.setMinutes(0, 0, 0)
  for (let i = 0; i < hours; i++) {
    const t = new Date(cursor)
    t.setHours(t.getHours() - i)
    const missing = isMissing(station, t, t.getHours())
    const pm10 = missing ? null : basePm10(sido, station, t, t.getHours())
    const pm25 = pm10 === null ? null : derivePm25(pm10, sido, station, t, t.getHours())
    const r = rng(hashString(['gas', station, toYMD(t), t.getHours()].join('|')))
    out.push({
      at: t.toISOString(),
      stationName: station,
      sidoName: sido,
      pm10,
      pm25,
      o3: missing ? null : Number((0.012 + r() * 0.055).toFixed(3)),
      no2: missing ? null : Number((0.008 + r() * 0.042).toFixed(3)),
      co: missing ? null : Number((0.3 + r() * 0.9).toFixed(1)),
      so2: missing ? null : Number((0.002 + r() * 0.007).toFixed(3)),
      khai: pm10 === null ? null : Math.round(pm10 * 1.05 + (pm25 ?? 0) * 0.7),
      flag: missing ? '점검및교정' : null,
    })
  }
  return out.reverse()
}

/** 기간 내 일별 집계 */
export function mockDaily(sido: string, station: string, from: string, to: string): DailyAggregate[] {
  return eachDay(parseYMD(from), parseYMD(to)).map((date) => {
    const d = parseYMD(date)
    const hourly = Array.from({ length: 24 }, (_, h) => {
      if (isMissing(station, d, h)) return null
      const pm10 = basePm10(sido, station, d, h)
      return { pm10, pm25: derivePm25(pm10, sido, station, d, h) }
    }).filter((x): x is { pm10: number; pm25: number } => x !== null)

    if (hourly.length === 0) {
      return { date, pm10Avg: null, pm25Avg: null, pm10Max: null, pm25Max: null, count: 0 }
    }
    const avg = (k: 'pm10' | 'pm25') =>
      Math.round(hourly.reduce((a, b) => a + b[k], 0) / hourly.length)
    return {
      date,
      pm10Avg: avg('pm10'),
      pm25Avg: avg('pm25'),
      pm10Max: Math.max(...hourly.map((v) => v.pm10)),
      pm25Max: Math.max(...hourly.map((v) => v.pm25)),
      count: hourly.length,
    }
  })
}

/** 전국 시도별 현재 요약 */
export function mockSidoSummary(now = new Date()): SidoSummary[] {
  return [...SIDO_LIST].map((sido) => {
    const stations = STATIONS[sido] ?? []
    const vals = stations.map((st) => {
      const pm10 = basePm10(sido, st, now, now.getHours())
      return { pm10, pm25: derivePm25(pm10, sido, st, now, now.getHours()) }
    })
    return {
      sidoName: sido,
      pm10Avg: Math.round(vals.reduce((a, b) => a + b.pm10, 0) / vals.length),
      pm25Avg: Math.round(vals.reduce((a, b) => a + b.pm25, 0) / vals.length),
      stationCount: stations.length,
    }
  })
}

const FORECAST_GRADES = ['좋음', '보통', '나쁨', '매우나쁨']

export function mockForecast(now = new Date()): Forecast[] {
  const target = addDays(now, 1)
  return (['PM10', 'PM25'] as const).map((code) => {
    const regions = [...SIDO_LIST].map((s) => {
      const base = basePm10(s, STATIONS[s]?.[0] ?? s, target, 9)
      const gi = base <= 30 ? 0 : base <= 80 ? 1 : base <= 150 ? 2 : 3
      return { region: s, grade: FORECAST_GRADES[gi] }
    })
    const worst = regions.reduce((acc, r) => Math.max(acc, FORECAST_GRADES.indexOf(r.grade)), 0)
    return {
      announcedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0).toISOString(),
      informCode: code,
      targetDate: toYMD(target),
      regions,
      overall: FORECAST_GRADES[worst],
      cause:
        worst >= 2
          ? '대기 정체로 국내 발생 미세먼지가 축적되고, 국외 유입이 더해져 농도가 높겠습니다.'
          : '원활한 대기 확산과 강수의 영향으로 대체로 낮은 농도를 보이겠습니다.',
    }
  })
}

export const MOCK_STATION_MAP = STATIONS
