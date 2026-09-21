/** 측정 항목 코드 */
export type Pollutant = 'pm10' | 'pm25' | 'o3' | 'no2' | 'co' | 'so2' | 'khai'

/** 대기질 등급 (환경부 4단계). 0 = 자료없음 */
export type GradeLevel = 0 | 1 | 2 | 3 | 4

/** 측정소 1곳의 한 시점 관측값 */
export interface Observation {
  /** 측정 일시 (ISO 문자열, 로컬 KST 기준) */
  at: string
  stationName: string
  sidoName?: string
  pm10?: number | null
  pm25?: number | null
  o3?: number | null
  no2?: number | null
  co?: number | null
  so2?: number | null
  khai?: number | null
  /** 원자료의 등급값(1~4). 없으면 농도로부터 계산한다. */
  pm10Grade?: GradeLevel
  pm25Grade?: GradeLevel
  khaiGrade?: GradeLevel
  /** 통신/점검 등으로 결측된 항목 */
  flag?: string | null
}

/** 일 단위로 집계한 값 */
export interface DailyAggregate {
  /** YYYY-MM-DD */
  date: string
  pm10Avg: number | null
  pm25Avg: number | null
  pm10Max: number | null
  pm25Max: number | null
  /** 해당일 유효 관측 개수 */
  count: number
}

/** 측정소 정보 */
export interface Station {
  stationName: string
  addr: string
  sidoName: string
  /** 측정망 (도시대기, 도로변대기 등) */
  mangName?: string
  year?: string
}

/** 시도별 실시간 요약 (랭킹용) */
export interface SidoSummary {
  sidoName: string
  pm10Avg: number | null
  pm25Avg: number | null
  stationCount: number
}

/** 대기질 예보 */
export interface Forecast {
  /** 예보 발표 일시 */
  announcedAt: string
  /** 예보 대상 항목 */
  informCode: 'PM10' | 'PM25' | 'O3'
  /** 예보 대상일 YYYY-MM-DD */
  targetDate: string
  /** 권역별 예보 등급 */
  regions: { region: string; grade: string }[]
  overall: string
  cause: string
}

/** 기간 프리셋 */
export type RangePreset = '7d' | '30d' | '90d' | '12m' | 'custom'

/** 데이터 출처 — 화면에 항상 표기한다 */
export type DataSource = 'live' | 'mock'

export interface Dataset<T> {
  data: T
  source: DataSource
  /** 조회 시각 */
  fetchedAt: string
  /** 데모 데이터로 폴백한 경우 그 사유 (화면 배너에 노출) */
  note?: string
}

/** 오픈 API 연결 진단 결과 — 설정 화면의 자가진단에 사용 */
export interface DiagnosticResult {
  name: string
  endpoint: string
  /** 'AUTH_OK_NO_DATA' = 인증은 통과했으나 데이터 접근 권한이 아직 반영되지 않음 */
  status: 'OK' | 'AUTH_OK_NO_DATA' | 'AUTH_FAIL' | 'SERVER' | 'NETWORK'
  message: string
  count?: number
  ms: number
}
