import { XMLParser } from 'fast-xml-parser'
import { API_BASE, API_TIMEOUT, HAS_KEY } from '../lib/config'

/** 공공데이터포털 표준 오류 — 화면에 그대로 보여줄 한국어 메시지로 변환한다. */
const RESULT_MESSAGE: Record<string, string> = {
  '00': '정상',
  '01': '어플리케이션 에러입니다. 잠시 후 다시 시도해 주세요.',
  '02': '데이터베이스 에러입니다.',
  '03': '조회 결과가 없습니다. 조건을 바꿔 다시 조회해 주세요.',
  '04': '서비스 연결에 실패했습니다.',
  '05': '에어코리아 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
  '10': '요청 파라미터가 잘못되었습니다.',
  '11': '필수 요청 파라미터가 누락되었습니다.',
  '12': '해당 오픈 API 서비스가 없거나 폐기되었습니다.',
  '20': '서비스 접근이 거부되었습니다. 활용신청 상태를 확인해 주세요.',
  '22': '일일 호출 횟수(트래픽)를 초과했습니다.',
  '30': '등록되지 않은 인증키입니다. .env.local 의 AIRKOREA_SERVICE_KEY 를 확인해 주세요.',
  '31': '인증키 사용 기간이 만료되었습니다.',
  '32': '등록되지 않은 도메인/IP 입니다.',
  '99': '기타 오류입니다.',
}

export class ApiError extends Error {
  readonly code?: string
  readonly hint?: string

  constructor(message: string, code?: string, hint?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.hint = hint
  }
}

const xml = new XMLParser({ ignoreAttributes: true, trimValues: true })

/** 응답 본문을 JSON 객체로 정규화. returnType=json 이어도 오류 시 XML 이 오는 경우가 있다. */
function normalize(text: string): Record<string, unknown> {
  const t = text.trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.parse(t)
    } catch {
      throw new ApiError('응답을 해석하지 못했습니다. (JSON 파싱 실패)')
    }
  }
  if (t.startsWith('<')) {
    const parsed = xml.parse(t) as Record<string, any>
    // 인증키 오류 등은 OpenAPI_ServiceResponse 래퍼로 내려온다
    const wrap = parsed.OpenAPI_ServiceResponse
    if (wrap?.cmmMsgHeader) {
      const code = String(wrap.cmmMsgHeader.returnReasonCode ?? '')
      throw new ApiError(
        RESULT_MESSAGE[code] ?? String(wrap.cmmMsgHeader.errMsg ?? '알 수 없는 오류'),
        code,
        code === '30' || code === '20'
          ? 'data.go.kr 에서 해당 API 활용신청이 승인되었는지, Decoding 인증키를 넣었는지 확인해 주세요.'
          : undefined,
      )
    }
    return parsed
  }
  throw new ApiError('빈 응답을 받았습니다. 네트워크 상태를 확인해 주세요.')
}

interface AirResponse<T> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: { items?: T[] | { item?: T[] }; totalCount?: number; numOfRows?: number; pageNo?: number }
  }
}

function unwrapItems<T>(payload: unknown): T[] {
  const r = (payload as AirResponse<T>).response
  if (!r) throw new ApiError('예상과 다른 응답 형식입니다.')

  const code = r.header?.resultCode ? String(r.header.resultCode).padStart(2, '0') : '00'
  if (code !== '00') {
    throw new ApiError(
      RESULT_MESSAGE[code] ?? r.header?.resultMsg ?? '오픈 API 오류',
      code,
      code === '30' || code === '20'
        ? 'data.go.kr 마이페이지에서 인증키와 활용신청 승인 여부를 확인해 주세요.'
        : undefined,
    )
  }

  const items = r.body?.items
  if (!items) return []
  if (Array.isArray(items)) return items
  const inner = (items as { item?: T[] | T }).item
  if (!inner) return []
  return Array.isArray(inner) ? inner : [inner]
}

/**
 * 오픈 API GET 호출.
 *
 * 인증키는 이 함수가 붙이지 않는다. 브라우저가 serviceKey 를 쿼리스트링에 실으면
 * 네트워크 탭·히스토리·Referer·접근 로그에 키가 그대로 남기 때문이다.
 * 키 주입은 프록시(개발: vite.config.ts / 배포: 리버스 프록시)가 담당하며,
 * 이 계층은 키가 '설정되어 있는지'만 안다.
 *
 * 프록시는 Decoding 키를 URLSearchParams 로 1회만 인코딩한다.
 * (Encoding 키를 그대로 넣으면 이중 인코딩되어 30번 오류가 난다.)
 */
export async function getItems<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T[]> {
  if (!HAS_KEY) {
    throw new ApiError(
      '인증키가 설정되지 않았습니다.',
      'NO_KEY',
      'app/.env.local 의 AIRKOREA_SERVICE_KEY 에 공공데이터포털 Decoding 인증키를 넣고 개발 서버를 재시작해 주세요.',
    )
  }

  // serviceKey 는 여기서 붙이지 않는다. 프록시가 서버 측에서 주입한다.
  const qs = new URLSearchParams({ returnType: 'json' })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT)
  try {
    const res = await fetch(`${API_BASE}${path}?${qs.toString()}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      // 프록시가 업스트림 지연을 504 + 사유 JSON 으로 알려주는 경우
      if (res.status === 504) {
        let detail = ''
        try {
          const body = (await res.clone().json()) as { proxyError?: boolean; message?: string }
          if (body?.proxyError && body.message) detail = ` ${body.message}`
        } catch {
          /* 본문이 JSON 이 아니면 무시한다 */
        }
        throw new ApiError(
          `에어코리아 서버가 제때 응답하지 않았습니다.${detail}`,
          '504',
          '공공 API 측 일시 지연입니다. 잠시 후 다시 조회해 주세요.',
        )
      }
      throw new ApiError(`서버가 ${res.status} 로 응답했습니다.`, String(res.status))
    }
    return unwrapItems<T>(normalize(await res.text()))
  } catch (e) {
    if (e instanceof ApiError) throw e
    if ((e as Error).name === 'AbortError') {
      throw new ApiError(`응답이 ${API_TIMEOUT / 1000}초 안에 오지 않았습니다.`, 'TIMEOUT')
    }
    throw new ApiError(
      '네트워크 요청에 실패했습니다.',
      'NETWORK',
      '개발 서버(vite dev)를 통해 /openapi 프록시로 호출하고 있는지 확인해 주세요.',
    )
  } finally {
    clearTimeout(timer)
  }
}

/** 인증키 / 활용신청 관련 오류인지 (= 사용자가 조치해야 하는 오류) */
export function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && ['20', '30', '31', '32', 'NO_KEY'].includes(e.code ?? '')
}

/** 재시도하면 풀릴 수 있는 일시적 오류인지 */
export function isTransientError(e: unknown): boolean {
  return e instanceof ApiError && ['01', '04', '05', '22', 'TIMEOUT', 'NETWORK'].includes(e.code ?? '')
}

/** '-' , '' , '통신장애' 등 결측 표기를 null 로 바꾸고 숫자로 변환 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s === '-' || s === '‐') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function grade(v: unknown): 0 | 1 | 2 | 3 | 4 {
  const n = num(v)
  if (n === null || n < 1 || n > 4) return 0
  return n as 1 | 2 | 3 | 4
}
