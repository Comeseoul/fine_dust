import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 공공데이터포털(apis.data.go.kr)은 CORS 헤더를 내려주지 않으므로
 * 브라우저에서 직접 호출할 수 없다. 개발 서버에서는 Vite 프록시로 우회하고,
 * 배포 시에는 동일 경로(/openapi)를 리버스 프록시로 연결한다.
 *
 * ⚠ 인증키는 프록시 단계에서 주입한다.
 *   브라우저가 serviceKey 를 쿼리스트링에 실어 보내면
 *   네트워크 탭 · 브라우저 히스토리 · Referer 헤더 · 접근 로그에 그대로 남는다.
 *   따라서 키는 VITE_ 접두사를 쓰지 않는 서버 전용 환경변수로 두고,
 *   프록시가 업스트림으로 넘길 때만 붙인다. 클라이언트 번들에는 포함되지 않는다.
 * → 자세한 내용은 /산출물/04_시스템아키텍처.md
 */
export default defineConfig(({ mode }) => {
  // VITE_ 접두사와 무관하게 모든 환경변수를 읽는다(세 번째 인자 '').
  const env = loadEnv(mode, process.cwd(), '')

  // 서버 전용 키를 우선 사용하고, 예전 방식(VITE_ 접두사)도 호환한다.
  const serviceKey = (env.AIRKOREA_SERVICE_KEY || env.VITE_AIRKOREA_SERVICE_KEY || '').trim()
  const usingLegacyKey = !env.AIRKOREA_SERVICE_KEY && !!env.VITE_AIRKOREA_SERVICE_KEY

  if (usingLegacyKey) {
    console.warn(
      '\n[보안 경고] VITE_AIRKOREA_SERVICE_KEY 는 클라이언트 번들에 포함됩니다.\n' +
        '           .env.local 에서 VITE_ 접두사를 떼고 AIRKOREA_SERVICE_KEY 로 바꿔 주세요.\n',
    )
  }

  return {
    plugins: [react()],
    // 키 값이 아니라 '설정 여부'만 클라이언트에 알린다.
    define: {
      __HAS_SERVICE_KEY__: JSON.stringify(serviceKey.length > 0),
    },
    server: {
      port: 5173,
      proxy: {
        '/openapi': {
          target: 'https://apis.data.go.kr',
          changeOrigin: true,
          secure: true,
          // 에어코리아 응답이 5~7초로 느리고 간헐적으로 더 지연된다.
          timeout: 20_000,
          proxyTimeout: 20_000,
          rewrite: (path) => {
            const stripped = path.replace(/^\/openapi/, '')
            if (!serviceKey) return stripped
            // 클라이언트가 보낸 serviceKey 는 무시하고 서버 값으로 덮어쓴다.
            const [base, query = ''] = stripped.split('?')
            const qs = new URLSearchParams(query)
            qs.set('serviceKey', serviceKey)
            return `${base}?${qs.toString()}`
          },
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              // 기본 동작은 빈 504 라 원인을 알 수 없다. 사유를 JSON 으로 돌려준다.
              const socket = res as unknown as { writeHead?: (c: number, h: object) => void; end?: (b: string) => void }
              if (typeof socket.writeHead === 'function' && typeof socket.end === 'function') {
                socket.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8' })
                socket.end(
                  JSON.stringify({
                    proxyError: true,
                    message: `에어코리아 서버가 응답하지 않습니다 (${err.message}).`,
                  }),
                )
              }
            })
          },
        },
      },
    },
  }
})
