import type { DataSource } from './types'

const env = import.meta.env

/**
 * 인증키는 클라이언트에 내려오지 않는다.
 * Vite 프록시(개발) / 리버스 프록시(배포)가 업스트림 호출 시에만 주입하며,
 * 여기서는 '설정되어 있는가' 여부만 빌드 타임 상수로 받는다.
 * → vite.config.ts 의 define: __HAS_SERVICE_KEY__
 */
declare const __HAS_SERVICE_KEY__: boolean
export const API_TIMEOUT: number = Number(env.VITE_API_TIMEOUT ?? 15000)
export const DEFAULT_SIDO: string = (env.VITE_DEFAULT_SIDO ?? '서울').trim()

export type SourceMode = 'auto' | 'live' | 'mock'

export const SOURCE_MODE: SourceMode =
  ((env.VITE_DATA_SOURCE ?? 'auto').trim() as SourceMode) || 'auto'

export const HAS_KEY: boolean =
  typeof __HAS_SERVICE_KEY__ === 'boolean' ? __HAS_SERVICE_KEY__ : false

/**
 * ⚠ HAS_KEY 는 '빌드 시점'에 확정되는 값이라 배포 환경에서는 믿을 수 없다.
 *
 * 개발: vite.config.ts 가 .env.local 을 읽어 정확한 값을 넣어준다.
 * 배포: 키는 서버리스 함수의 런타임 환경변수다. 빌드 단계에 그 변수가 주입되지
 *       않았다면 HAS_KEY 가 false 가 되는데, 그 값을 믿고 데모로 고정해 버리면
 *       함수에는 키가 멀쩡히 있는데도 앱이 영영 데모 데이터만 보여준다.
 *
 * 따라서 운영 빌드에서는 HAS_KEY 와 무관하게 항상 실데이터를 먼저 시도하고,
 * 키가 없다는 사실은 프록시 응답(500 / 오류코드 30)으로 확인한다.
 * 개발 빌드에서만 '키 없음 → 즉시 데모' 빠른 경로를 유지한다.
 */
const IS_DEV: boolean = env.DEV === true

/**
 * auto  : 실데이터를 먼저 시도하고, 실패하거나 0건이면 데모 데이터로 폴백한다.
 *         (활용신청 직후 권한 전파 지연 / 에어코리아 서버 점검 대응)
 * live  : 항상 실데이터. 실패해도 폴백하지 않고 오류를 그대로 보여준다.
 * mock  : 항상 데모 데이터. 오프라인 시연·발표용.
 */
export const ALLOW_FALLBACK = SOURCE_MODE === 'auto'
export const FORCE_MOCK =
  SOURCE_MODE === 'mock' || (SOURCE_MODE === 'auto' && !HAS_KEY && IS_DEV)
export const KEY_MISSING_BUT_REQUIRED = SOURCE_MODE === 'live' && !HAS_KEY && IS_DEV

/** 키 없음을 사전에 차단할지 여부 — 개발 환경에서만 의미가 있다. */
export const SKIP_CALL_WITHOUT_KEY = IS_DEV && !HAS_KEY

/** 초기 표시용 추정값. 실제 출처는 각 응답의 Dataset.source 를 따른다. */
export const INITIAL_SOURCE: DataSource = FORCE_MOCK ? 'mock' : 'live'

/** 개발: Vite 프록시(/openapi) · 배포: 동일 경로를 리버스 프록시로 연결 */
export const API_BASE = '/openapi'

export const SIDO_LIST = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const

export type Sido = (typeof SIDO_LIST)[number]

/** 시도명 → 대기질 예보 권역명 매핑 */
export const SIDO_TO_FORECAST_REGION: Record<string, string> = {
  서울: '서울', 인천: '인천', 경기: '경기남부', 강원: '강원영서',
  대전: '대전', 세종: '세종', 충남: '충남', 충북: '충북',
  광주: '광주', 전북: '전북', 전남: '전남',
  부산: '부산', 대구: '대구', 울산: '울산', 경북: '경북', 경남: '경남',
  제주: '제주',
}
