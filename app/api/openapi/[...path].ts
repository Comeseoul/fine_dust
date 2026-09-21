/**
 * 배포 환경 전용 오픈 API 프록시 (Vercel Function).
 *
 * `vite.config.ts` 의 server.proxy 가 같은 일을 하지만 그 설정은 `vite dev` 에서만
 * 동작하고 `vite build` 결과물에는 남지 않는다. 따라서 배포본에서 `/openapi/*` 를
 * 받아 줄 서버 측 대역이 별도로 필요하다. (vercel.json 의 rewrite 가 연결한다)
 *
 * 인증키는 이 계층에서만 주입한다. 클라이언트가 보낸 serviceKey 는 무시하고 서버
 * 환경변수 값으로 덮어써, 키가 브라우저 네트워크 탭·히스토리·Referer·접근 로그에
 * 남지 않도록 한다. → src/api/client.ts 의 getItems 주석 참고.
 */

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

/** 에어코리아 응답이 5~7초, 간헐적으로 더 지연된다. vite 프록시와 같은 값으로 맞춘다. */
const UPSTREAM_TIMEOUT = 20_000

/** client.ts 가 504 본문에서 읽어 가는 형식({ proxyError, message })으로 돌려준다. */
function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ proxyError: true, message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: Request): Promise<Response> {
  const serviceKey = (process.env.AIRKOREA_SERVICE_KEY ?? '').trim()
  if (!serviceKey) {
    return fail(500, 'AIRKOREA_SERVICE_KEY 환경변수가 설정되지 않았습니다.')
  }

  const incoming = new URL(request.url)
  // rewrite 전(/openapi/...) · 후(/api/openapi/...) 어느 형태로 들어오든 업스트림 경로만 남긴다.
  const path = incoming.pathname
    .replace(/^\/api\/openapi/, '')
    .replace(/^\/openapi/, '')

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return fail(404, '허용되지 않은 경로입니다.')
  }

  // Decoding 키를 URLSearchParams 로 1회만 인코딩한다.
  // (Encoding 키를 넣으면 이중 인코딩되어 30번 오류가 난다.)
  const qs = new URLSearchParams(incoming.search)
  qs.set('serviceKey', serviceKey)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT)
  try {
    const upstream = await fetch(`${UPSTREAM}${path}?${qs.toString()}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
        // 에어코리아는 일일 호출 한도(오류코드 22)가 있다. 측정값은 1시간 주기로
        // 갱신되므로 짧게 캐시해도 신선도를 잃지 않고 호출량을 줄일 수 있다.
        'Cache-Control': upstream.ok
          ? 'public, s-maxage=60, stale-while-revalidate=600'
          : 'no-store',
      },
    })
  } catch (e) {
    const reason =
      (e as Error).name === 'AbortError'
        ? `${UPSTREAM_TIMEOUT / 1000}초 안에 응답하지 않았습니다`
        : (e as Error).message
    return fail(504, `에어코리아 서버가 응답하지 않습니다 (${reason}).`)
  } finally {
    clearTimeout(timer)
  }
}
