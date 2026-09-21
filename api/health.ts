/**
 * 배포 진단용 헬스 엔드포인트.
 *
 * "서버리스 함수가 배포되긴 했는가?" 를 라우팅 문제와 분리해서 확인하기 위한 것이다.
 * 동적 경로([...param])나 rewrite 를 전혀 쓰지 않는 가장 단순한 함수이므로,
 * 이 엔드포인트가 404 면 함수 빌드 자체가 안 된 것이고,
 * 200 인데 /api/openapi 가 404 면 그쪽 라우팅/파일명 문제다.
 *
 * 인증키 값은 노출하지 않는다. 설정 여부(boolean)만 돌려준다.
 */

interface Res {
  status(code: number): Res
  setHeader(name: string, value: string): void
  send(body: string): void
}

export default function handler(_req: unknown, res: Res): void {
  res.status(200)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(
    JSON.stringify({
      ok: true,
      // 키 자체가 아니라 '설정되어 있는가' 만 보고한다.
      serviceKeyConfigured: Boolean((process.env.AIRKOREA_SERVICE_KEY ?? '').trim()),
      node: process.version,
      time: new Date().toISOString(),
    }),
  )
}
