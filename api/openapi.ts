/**
 * 배포 환경 전용 오픈 API 프록시 (Vercel Serverless Function).
 *
 * `vite.config.ts` 의 server.proxy 가 같은 일을 하지만 그 설정은 `vite dev` 에서만
 * 동작하고 `vite build` 결과물에는 남지 않는다. 따라서 배포본에서 `/openapi/*` 를
 * 받아 줄 서버 측 대역이 별도로 필요하다.
 *
 * 인증키는 이 계층에서만 주입한다. 클라이언트가 보낸 serviceKey 는 무시하고 서버
 * 환경변수 값으로 덮어써, 키가 브라우저 네트워크 탭·히스토리·Referer·접근 로그에
 * 남지 않도록 한다. → src/api/client.ts 의 getItems 주석 참고.
 *
 * ⚠ 왜 동적 경로(api/openapi/[...path].ts)를 쓰지 않는가
 *   처음에는 catch-all 파일명으로 만들었으나 배포 후 /api/openapi/* 가 계속 404 였다.
 *   파일명의 대괄호는 vercel.json 의 functions 글롭에서도, 플랫폼의 라우팅 규칙에서도
 *   해석이 갈리는 지점이라 원인 추적이 어렵다. 그래서 동적 경로를 아예 없애고
 *   평범한 단일 함수로 두고, 업스트림 경로는 rewrite 가 __path 쿼리로 넘겨준다.
 *     vercel.json:  /openapi/:path*  →  /api/openapi?__path=:path*
 *   (원래 쿼리스트링은 rewrite 시 그대로 보존되어 병합된다)
 */

/** 최소한의 구조적 타입 — @vercel/node 에 의존하지 않기 위해 직접 선언한다. */
interface ProxyRequest {
  method?: string
  url?: string
}

interface ProxyResponse {
  status(code: number): ProxyResponse
  setHeader(name: string, value: string): void
  send(body: string): void
}

const UPSTREAM = 'https://apis.data.go.kr'

/**
 * 에어코리아 3종 서비스만 허용한다.
 * 인증키를 주입해 주는 프록시가 열려 있으면 제3자가 우리 키로 임의의
 * data.go.kr API 를 호출할 수 있고, 일일 호출 한도까지 소진된다.
 */
const ALLOWED_PREFIXES = [
  '/B552584/ArpltnInforInqireSvc/',
  '/B552584/MsrstnInfoInqireSvc/',
  '/B552584/ArpltnStatsSvc/',
]

/**
 * 에어코리아 응답은 보통 5~7초다.
 * Vercel 함수의 실행 제한(기본 10초)보다 짧게 잡아, 플랫폼이 함수를 죽이기 전에
 * 우리가 사유가 담긴 504 를 돌려줄 수 있게 한다. (본문 없는 504 는 원인 추적이 불가능하다)
 */
const UPSTREAM_TIMEOUT = 9_000

/** client.ts 가 504 본문에서 읽어 가는 형식({ proxyError, message })으로 돌려준다. */
function fail(res: ProxyResponse, status: number, message: string): void {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(JSON.stringify({ proxyError: true, message }))
}

export default async function handler(req: ProxyRequest, res: ProxyResponse): Promise<void> {
  if (req.method && req.method !== 'GET') {
    return fail(res, 405, 'GET 요청만 지원합니다.')
  }

  const serviceKey = (process.env.AIRKOREA_SERVICE_KEY ?? '').trim()
  if (!serviceKey) {
    return fail(res, 500, 'AIRKOREA_SERVICE_KEY 환경변수가 설정되지 않았습니다.')
  }

  // req.url 은 경로+쿼리만 담기므로 더미 origin 을 붙여 파싱한다.
  const incoming = new URL(req.url ?? '/', 'http://localhost')
  const qs = new URLSearchParams(incoming.search)

  // rewrite 가 넘겨준 업스트림 경로. 직접 호출된 경우를 대비해 pathname 도 본다.
  const raw =
    qs.get('__path') ??
    incoming.pathname.replace(/^\/api\/openapi/, '').replace(/^\/openapi/, '')
  qs.delete('__path')

  const path = raw.startsWith('/') ? raw : `/${raw}`

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return fail(res, 404, `허용되지 않은 경로입니다. (${path})`)
  }

  // Decoding 키를 URLSearchParams 로 1회만 인코딩한다.
  // (Encoding 키를 넣으면 이중 인코딩되어 30번 오류가 난다.)
  qs.set('serviceKey', serviceKey)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT)
  try {
    const upstream = await fetch(`${UPSTREAM}${path}?${qs.toString()}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    const body = await upstream.text()

    res.status(upstream.status)
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    )
    // 에어코리아는 일일 호출 한도(오류코드 22)가 있다. 측정값은 1시간 주기로
    // 갱신되므로 짧게 캐시해도 신선도를 잃지 않고 호출량을 줄일 수 있다.
    res.setHeader(
      'Cache-Control',
      upstream.ok ? 'public, s-maxage=60, stale-while-revalidate=600' : 'no-store',
    )
    res.send(body)
  } catch (e) {
    const reason =
      (e as Error).name === 'AbortError'
        ? `${UPSTREAM_TIMEOUT / 1000}초 안에 응답하지 않았습니다`
        : (e as Error).message
    fail(res, 504, `에어코리아 서버가 응답하지 않습니다 (${reason}).`)
  } finally {
    clearTimeout(timer)
  }
}
