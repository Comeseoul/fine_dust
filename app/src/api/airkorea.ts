/** ============================================================================
 *  에어코리아 오픈 API 연동 계층
 *  화면(페이지/훅)은 이 파일의 함수만 호출한다. 실데이터/데모 데이터 분기,
 *  응답 스키마 → 도메인 모델 변환, 일 단위 집계를 모두 여기서 책임진다.
 *
 *  사용 서비스 (공공데이터포털, 인증키 1개 공용)
 *    B552584/ArpltnInforInqireSvc   대기오염정보     실시간 측정 / 예보
 *    B552584/MsrstnInfoInqireSvc    측정소정보       측정소 목록
 *    B552584/ArpltnStatsSvc         대기오염통계현황  일/월 평균
 *
 *  ⚠ 폴백 정책 (VITE_DATA_SOURCE=auto)
 *    활용신청 직후에는 인증은 통과(resultCode 00)하지만 데이터 접근 권한이
 *    아직 반영되지 않아 totalCount=0 이 내려오는 구간이 있다(최대 1시간).
 *    에어코리아 백엔드의 SERVICETIMEOUT_ERROR(05) 도 간헐적으로 발생한다.
 *    따라서 auto 모드에서는 실데이터를 먼저 시도하고, 오류이거나 0건이면
 *    데모 데이터로 폴백하되 그 사유를 note 에 담아 화면 배너로 노출한다.
 *    권한이 반영되면 코드 수정 없이 자동으로 실데이터로 되돌아온다.
 *  → 파라미터 상세는 /산출물/03_API연동명세서.md
 *  ==========================================================================*/

import { ALLOW_FALLBACK, FORCE_MOCK, SIDO_LIST } from '../lib/config'
import { parseDataTime, toCompact, toYMD, parseYMD, eachDay } from '../lib/date'
import { mean, maxOf } from '../lib/format'
import { ApiError, getItems, grade, isAuthError, num } from './client'
import { mockDaily, mockForecast, mockHourly, mockSidoSummary, mockStations } from './mock'
import type {
  DailyAggregate,
  Dataset,
  DiagnosticResult,
  Forecast,
  Observation,
  SidoSummary,
  Station,
} from '../lib/types'

const INFO = '/B552584/ArpltnInforInqireSvc'
const MSRSTN = '/B552584/MsrstnInfoInqireSvc'
const STATS = '/B552584/ArpltnStatsSvc'

const stamp = (): string => new Date().toISOString()

const NO_DATA_NOTE =
  '인증은 통과했지만 오픈 API가 0건을 반환했습니다. 활용신청 직후에는 데이터 권한 반영에 최대 1시간이 걸립니다.'

function live<T>(data: T): Dataset<T> {
  return { data, source: 'live', fetchedAt: stamp() }
}

function demo<T>(data: T, note?: string): Dataset<T> {
  return { data, source: 'mock', fetchedAt: stamp(), note }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 실데이터 우선 → 조건부 폴백을 한곳에서 처리한다.
 *
 * 에어코리아는 동일한 요청에 대해 정상 응답과 0건/SERVICETIMEOUT 을 번갈아 주는
 * 구간이 있어, 한 번 실패했다고 바로 데모로 내리면 실데이터를 놓친다.
 * 따라서 '빈 결과 / 일시적 오류'에 한해 1회만 재시도한 뒤 폴백한다.
 * 인증 오류(키·활용신청 문제)는 재시도해도 의미가 없으므로 즉시 폴백한다.
 * live 모드에서는 폴백하지 않고 오류/빈 결과를 그대로 전달한다.
 */
async function resolve<T>(
  fetchLive: () => Promise<T>,
  isEmpty: (v: T) => boolean,
  buildMock: () => T,
): Promise<Dataset<T>> {
  if (FORCE_MOCK) return demo(buildMock())

  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(700)
    try {
      const result = await fetchLive()
      if (!isEmpty(result)) return live(result)
      if (!ALLOW_FALLBACK) return live(result)
      lastError = null // 0건 — 재시도할 가치가 있다 (같은 요청에 정상이 오기도 한다)
    } catch (e) {
      lastError = e
      if (!ALLOW_FALLBACK) throw e
      // 재시도해도 결과가 같거나, 이미 오래 기다린 오류는 즉시 폴백한다.
      //  · 인증 오류(20/30)  : 결과가 바뀌지 않음
      //  · 타임아웃/네트워크/5xx : 이미 timeout 만큼 기다렸다. 한 번 더 하면 대기가 두 배가 된다.
      // 빠르게 떨어지는 SERVICETIMEOUT_ERROR(05) 만 한 번 더 시도한다.
      if (!(e instanceof ApiError) || e.code !== '05') break
    }
  }

  if (lastError instanceof ApiError) {
    const reason =
      isAuthError(lastError) && lastError.hint
        ? `${lastError.message} ${lastError.hint}`
        : lastError.message
    return demo(buildMock(), reason)
  }
  if (lastError) return demo(buildMock(), '오픈 API 호출에 실패했습니다.')
  return demo(buildMock(), NO_DATA_NOTE)
}

const emptyArray = (v: unknown[]) => v.length === 0

/* -------------------------------------------------------------------------- */
/*  측정소 목록                                                                */
/* -------------------------------------------------------------------------- */

interface RawStation {
  stationName?: string
  addr?: string
  mangName?: string
  year?: string
}

export function fetchStations(sido: string): Promise<Dataset<Station[]>> {
  return resolve<Station[]>(
    async () => {
      const rows = await getItems<RawStation>(`${MSRSTN}/getMsrstnList`, {
        addr: sido,
        numOfRows: 200,
        pageNo: 1,
      })
      return rows
        .filter((r) => r.stationName)
        .map((r) => ({
          stationName: String(r.stationName),
          addr: String(r.addr ?? ''),
          sidoName: sido,
          mangName: r.mangName ? String(r.mangName) : undefined,
          year: r.year ? String(r.year) : undefined,
        }))
    },
    emptyArray,
    () => mockStations(sido),
  )
}

/* -------------------------------------------------------------------------- */
/*  측정소별 시간 단위 측정값                                                    */
/* -------------------------------------------------------------------------- */

interface RawMeasure {
  dataTime?: string
  stationName?: string
  sidoName?: string
  pm10Value?: string
  pm25Value?: string
  o3Value?: string
  no2Value?: string
  coValue?: string
  so2Value?: string
  khaiValue?: string
  pm10Grade?: string
  pm25Grade?: string
  khaiGrade?: string
  pm10Flag?: string
  pm25Flag?: string
}

function toObservation(r: RawMeasure, sido: string, station: string): Observation | null {
  const t = parseDataTime(r.dataTime)
  if (!t) return null
  return {
    at: t.toISOString(),
    stationName: String(r.stationName ?? station),
    sidoName: String(r.sidoName ?? sido),
    pm10: num(r.pm10Value),
    pm25: num(r.pm25Value),
    o3: num(r.o3Value),
    no2: num(r.no2Value),
    co: num(r.coValue),
    so2: num(r.so2Value),
    khai: num(r.khaiValue),
    pm10Grade: grade(r.pm10Grade),
    pm25Grade: grade(r.pm25Grade),
    khaiGrade: grade(r.khaiGrade),
    flag: r.pm10Flag || r.pm25Flag || null,
  }
}

/** dataTerm: DAILY(최근 24시간) | MONTH(최근 1개월) | 3MONTH(최근 3개월) */
export function fetchHourly(
  sido: string,
  station: string,
  dataTerm: 'DAILY' | 'MONTH' | '3MONTH' = 'DAILY',
): Promise<Dataset<Observation[]>> {
  const hours = dataTerm === 'DAILY' ? 24 : dataTerm === 'MONTH' ? 24 * 31 : 24 * 92
  return resolve<Observation[]>(
    async () => {
      const rows = await getItems<RawMeasure>(`${INFO}/getMsrstnAcctoRltmMesureDnsty`, {
        stationName: station,
        dataTerm,
        ver: '1.3',
        numOfRows: dataTerm === 'DAILY' ? 24 : 999,
        pageNo: 1,
      })
      return rows
        .map((r) => toObservation(r, sido, station))
        .filter((o): o is Observation => o !== null)
        .sort((a, b) => a.at.localeCompare(b.at))
    },
    emptyArray,
    () => mockHourly(sido, station, hours),
  )
}

/* -------------------------------------------------------------------------- */
/*  시도 내 전 측정소 현황                                                      */
/* -------------------------------------------------------------------------- */

export function fetchSidoStations(sido: string): Promise<Dataset<Observation[]>> {
  return resolve<Observation[]>(
    async () => {
      const rows = await getItems<RawMeasure>(`${INFO}/getCtprvnRltmMesureDnsty`, {
        sidoName: sido,
        ver: '1.3',
        numOfRows: 200,
        pageNo: 1,
      })
      return rows
        .map((r) => toObservation(r, sido, String(r.stationName ?? '')))
        .filter((o): o is Observation => o !== null)
    },
    emptyArray,
    () => {
      const now = new Date()
      return mockStations(sido)
        .map((s) => mockHourly(sido, s.stationName, 1, now)[0])
        .filter(Boolean)
    },
  )
}

async function sidoAverage(sido: string): Promise<SidoSummary> {
  const rows = await getItems<RawMeasure>(`${INFO}/getCtprvnRltmMesureDnsty`, {
    sidoName: sido,
    ver: '1.3',
    numOfRows: 200,
    pageNo: 1,
  })
  return {
    sidoName: sido,
    pm10Avg: mean(rows.map((r) => num(r.pm10Value))),
    pm25Avg: mean(rows.map((r) => num(r.pm25Value))),
    stationCount: rows.length,
  }
}

/**
 * 전국 17개 시도 평균 — 랭킹/비교용.
 *
 * 에어코리아에는 '전국 시도 평균'을 한 번에 주는 실시간 엔드포인트가 없어
 * 시도별로 호출해야 한다. 다만 서비스가 죽어 있을 때 17건을 한꺼번에 던지면
 * 실패 대기만 쌓이므로, 먼저 한 곳만 찔러보고 살아 있을 때만 나머지를 부른다.
 */
export function fetchNationwide(): Promise<Dataset<SidoSummary[]>> {
  return resolve<SidoSummary[]>(
    async () => {
      const probe = await sidoAverage(SIDO_LIST[0])
      if (probe.stationCount === 0) return [] // 죽어 있으면 나머지는 시도하지 않는다
      const rest = await Promise.allSettled(SIDO_LIST.slice(1).map(sidoAverage))
      return [
        probe,
        ...rest.filter((s) => s.status === 'fulfilled').map((s) => s.value),
      ].filter((v) => v.stationCount > 0)
    },
    emptyArray,
    () => mockSidoSummary(),
  )
}

/* -------------------------------------------------------------------------- */
/*  일 단위 이력 / 통계                                                         */
/* -------------------------------------------------------------------------- */

interface RawDaily {
  msurDt?: string
  msrstnName?: string
  pm10Value?: string
  pm25Value?: string
  pm10?: string
  pm25?: string
}

/** 측정소별 일평균 이력 */
export function fetchDaily(
  sido: string,
  station: string,
  from: string,
  to: string,
): Promise<Dataset<DailyAggregate[]>> {
  const allDates = eachDay(parseYMD(from), parseYMD(to))

  return resolve<DailyAggregate[]>(
    async () => {
      const rows = await getItems<RawDaily>(`${STATS}/getMsrstnAcctoRDyrg`, {
        msrstnName: station,
        inqBginDt: toCompact(parseYMD(from)),
        inqEndDt: toCompact(parseYMD(to)),
        numOfRows: 999,
        pageNo: 1,
      })
      if (rows.length === 0) return []

      const byDate = new Map<string, DailyAggregate>()
      for (const r of rows) {
        const raw = String(r.msurDt ?? '')
        if (raw.length < 8) continue
        const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        const pm10 = num(r.pm10Value ?? r.pm10)
        const pm25 = num(r.pm25Value ?? r.pm25)
        byDate.set(date, {
          date,
          pm10Avg: pm10,
          pm25Avg: pm25,
          pm10Max: pm10,
          pm25Max: pm25,
          count: pm10 !== null || pm25 !== null ? 1 : 0,
        })
      }
      // 응답에 없는 날짜도 결측으로 채워 시계열 길이를 보존한다.
      return allDates.map(
        (d) =>
          byDate.get(d) ?? {
            date: d,
            pm10Avg: null,
            pm25Avg: null,
            pm10Max: null,
            pm25Max: null,
            count: 0,
          },
      )
    },
    (v) => v.length === 0 || v.every((d) => d.count === 0),
    () => mockDaily(sido, station, from, to),
  )
}

/** 시간별 관측 → 일별 집계 (일평균 API가 비어 있을 때의 대체 경로) */
export function aggregateDaily(obs: Observation[]): DailyAggregate[] {
  const bucket = new Map<string, Observation[]>()
  for (const o of obs) {
    const d = toYMD(new Date(o.at))
    if (!bucket.has(d)) bucket.set(d, [])
    bucket.get(d)!.push(o)
  }
  return [...bucket.entries()]
    .map(([date, list]) => ({
      date,
      pm10Avg: mean(list.map((x) => x.pm10)),
      pm25Avg: mean(list.map((x) => x.pm25)),
      pm10Max: maxOf(list.map((x) => x.pm10)),
      pm25Max: maxOf(list.map((x) => x.pm25)),
      count: list.filter((x) => x.pm10 !== null || x.pm25 !== null).length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* -------------------------------------------------------------------------- */
/*  대기질 예보                                                                 */
/* -------------------------------------------------------------------------- */

interface RawForecast {
  dataTime?: string
  informCode?: string
  informData?: string
  informGrade?: string
  informOverall?: string
  informCause?: string
}

export function fetchForecast(): Promise<Dataset<Forecast[]>> {
  return resolve<Forecast[]>(
    async () => {
      const rows = await getItems<RawForecast>(`${INFO}/getMinuDustFrcstDspth`, {
        searchDate: toYMD(new Date()),
        numOfRows: 50,
        pageNo: 1,
      })

      const parsed: Forecast[] = rows
        .filter((r) => r.informCode === 'PM10' || r.informCode === 'PM25')
        .map((r) => ({
          announcedAt: parseDataTime(r.dataTime)?.toISOString() ?? stamp(),
          informCode: r.informCode as 'PM10' | 'PM25',
          targetDate: String(r.informData ?? ''),
          // informGrade 예: "서울 : 보통,인천 : 나쁨,경기남부 : 보통"
          regions: String(r.informGrade ?? '')
            .split(',')
            .map((chunk) => {
              const [region, g] = chunk.split(':').map((s) => s.trim())
              return { region: region ?? '', grade: g ?? '' }
            })
            .filter((x) => x.region && x.grade),
          overall: String(r.informOverall ?? ''),
          cause: String(r.informCause ?? ''),
        }))

      // 같은 항목이 여러 발표분으로 오면 최신 것만 남긴다.
      const latest = new Map<string, Forecast>()
      for (const f of parsed) {
        const key = `${f.informCode}|${f.targetDate}`
        const prev = latest.get(key)
        if (!prev || prev.announcedAt < f.announcedAt) latest.set(key, f)
      }
      return [...latest.values()].sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    },
    emptyArray,
    () => mockForecast(),
  )
}

/* -------------------------------------------------------------------------- */
/*  오픈 API 자가진단 (설정 화면)                                               */
/* -------------------------------------------------------------------------- */

const PROBES: { name: string; endpoint: string; params: Record<string, string | number> }[] = [
  {
    name: '대기오염정보 · 시도별 실시간',
    endpoint: `${INFO}/getCtprvnRltmMesureDnsty`,
    params: { sidoName: '서울', ver: '1.3', numOfRows: 5, pageNo: 1 },
  },
  {
    name: '측정소정보 · 측정소 목록',
    endpoint: `${MSRSTN}/getMsrstnList`,
    params: { addr: '서울', numOfRows: 5, pageNo: 1 },
  },
  {
    name: '대기오염정보 · 대기질 예보',
    endpoint: `${INFO}/getMinuDustFrcstDspth`,
    params: { searchDate: toYMD(new Date()), numOfRows: 5, pageNo: 1 },
  },
  {
    name: '통계현황 · 측정소별 일평균',
    endpoint: `${STATS}/getMsrstnAcctoRDyrg`,
    params: (() => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 7)
      return {
        msrstnName: '종로구',
        inqBginDt: toCompact(from),
        inqEndDt: toCompact(to),
        numOfRows: 5,
        pageNo: 1,
      }
    })(),
  },
]

/** 4개 엔드포인트를 실제로 호출해 인증/권한/서버 상태를 구분해 보고한다. */
export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  return Promise.all(
    PROBES.map(async ({ name, endpoint, params }) => {
      const t0 = performance.now()
      try {
        const rows = await getItems<unknown>(endpoint, params)
        const ms = Math.round(performance.now() - t0)
        if (rows.length > 0) {
          return { name, endpoint, status: 'OK' as const, message: `정상 · ${rows.length}건 수신`, count: rows.length, ms }
        }
        return {
          name,
          endpoint,
          status: 'AUTH_OK_NO_DATA' as const,
          message: '인증은 통과했으나 데이터가 0건입니다. 활용신청 직후 권한 반영(최대 1시간) 대기 중일 수 있습니다.',
          count: 0,
          ms,
        }
      } catch (e) {
        const ms = Math.round(performance.now() - t0)
        const err = e instanceof ApiError ? e : new ApiError('알 수 없는 오류')
        const status = isAuthError(err) ? ('AUTH_FAIL' as const)
          : err.code === 'NETWORK' ? ('NETWORK' as const)
          : ('SERVER' as const)
        return { name, endpoint, status, message: err.hint ? `${err.message} ${err.hint}` : err.message, ms }
      }
    }),
  )
}
