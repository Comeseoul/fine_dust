/** 산출물 문서를 '인증키 프록시 주입' 구조에 맞게 갱신 */
const fs = require('fs')
const P = 'C:/Users/syc226283/jobu/산출물/'
const B = '`' // 백틱

const read = (f) => fs.readFileSync(P + f, 'utf8')
const write = (f, s) => fs.writeFileSync(P + f, s)

/* ---------------- 04 시스템아키텍처 ---------------- */
let a = read('04_시스템아키텍처.md')

const oldNote = `> 인증키가 프런트엔드 번들에 포함되는 구조이므로, 실제 운영 배포 시에는
> 인증키를 서버 측에서 주입하는 BFF(Backend For Frontend)로 바꾸는 것이 안전합니다.
> 본 과제는 프런트엔드 단독 범위이므로 프록시 방식으로 구성했습니다. — **미적용 사항**`

const newSection = [
  '### 3.1 인증키 보호 — 프록시 주입',
  '',
  `초기 구현은 브라우저가 ${B}serviceKey${B} 를 쿼리스트링에 실어 보냈습니다.`,
  '이 구조에서는 인증키가 **브라우저 네트워크 탭 · 히스토리 · Referer 헤더 · 접근 로그**에',
  '그대로 남습니다. 개발 중 DevTools 네트워크 탭에서 키 전문이 노출되는 것을 실제로 확인했습니다.',
  '',
  '**조치** — 키 주입 지점을 클라이언트에서 프록시로 옮겼습니다.',
  '',
  '| 구분 | 변경 전 | 변경 후 |',
  '|---|---|---|',
  `| 환경변수 | ${B}VITE_AIRKOREA_SERVICE_KEY${B} | ${B}AIRKOREA_SERVICE_KEY${B} (VITE_ 접두사 제거) |`,
  '| 클라이언트 번들 | 키 값 포함 | **미포함** (설정 여부 boolean 만 주입) |',
  `| 브라우저 요청 | ${B}?serviceKey=...&...${B} | ${B}?returnType=json&...${B} |`,
  '| 키 주입 주체 | 클라이언트 | 프록시 (개발: Vite / 배포: 리버스 프록시) |',
  '',
  `Vite 설정에서 ${B}loadEnv(mode, cwd, '')${B} 로 VITE_ 접두사가 없는 변수까지 읽고,`,
  `${B}rewrite${B} 단계에서 서버 측 키를 붙입니다. 클라이언트가 임의로 ${B}serviceKey${B} 를 보내더라도`,
  '프록시가 서버 값으로 덮어씁니다.',
  '',
  '```ts',
  "// 값이 아니라 '설정 여부'만 클라이언트에 알린다",
  'define: { __HAS_SERVICE_KEY__: JSON.stringify(serviceKey.length > 0) },',
  '',
  'rewrite: (path) => {',
  "  const [base, query = ''] = path.replace(/^\\/openapi/, '').split('?')",
  '  const qs = new URLSearchParams(query)',
  "  qs.set('serviceKey', serviceKey)   // 서버 값으로 덮어쓴다",
  '  return `${base}?${qs.toString()}`',
  '}',
  '```',
  '',
  '**검증 결과**',
  '',
  '```bash',
  '$ grep -r "$KEY" dist/              →  결과 없음',
  '$ grep -r "serviceKey" dist/assets/ →  결과 없음',
  '```',
  '',
  '브라우저 네트워크 탭 실측 (5건 전부 200 OK):',
  '',
  '```',
  '/openapi/B552584/ArpltnStatsSvc/getMsrstnAcctoRDyrg?returnType=json&msrstnName=청계천로&...',
  '                                                    ↑ serviceKey 없음',
  '```',
  '',
  '> 배포 환경에도 같은 원칙을 적용합니다. 리버스 프록시가 키를 붙이며,',
  '> 키 값은 환경변수나 시크릿 매니저에서 주입하고 설정 파일에 직접 쓰지 않습니다.',
  '',
  '### 3.2 프록시 타임아웃',
  '',
  '에어코리아 응답이 5~7초로 느리고 간헐적으로 더 지연됩니다. 기본 설정에서는',
  '지연 시 프록시가 **본문 없는 504** 를 내려 원인을 알 수 없었습니다.',
  `${B}timeout / proxyTimeout${B} 을 20초로 두고, 오류 시 사유를 JSON 으로 돌려주도록 했습니다.`,
  '클라이언트는 이 응답을 받아 "에어코리아 서버가 제때 응답하지 않았습니다"로 번역합니다.',
].join('\n')

if (a.includes(oldNote)) {
  a = a.replace(oldNote, newSection)
} else {
  console.warn('  [04] 기존 주석을 찾지 못해 섹션을 추가하지 않았습니다.')
}
a = a.replace(
  `| ${B}VITE_AIRKOREA_SERVICE_KEY${B} | ✅ | — | 공공데이터포털 **Decoding** 인증키 |`,
  `| ${B}AIRKOREA_SERVICE_KEY${B} | ✅ | — | 공공데이터포털 **Decoding** 인증키 (VITE_ 접두사 없음 = 서버 전용) |`,
)
write('04_시스템아키텍처.md', a)

/* ---------------- 09 사용자매뉴얼 ---------------- */
let m = read('09_사용자매뉴얼.md')
m = m.split('VITE_AIRKOREA_SERVICE_KEY').join('AIRKOREA_SERVICE_KEY')
m = m.replace(
  `> ${B}.env.local${B} 은 ${B}.gitignore${B} 에 포함되어 커밋되지 않습니다.`,
  [
    `> ${B}.env.local${B} 은 ${B}.gitignore${B} 에 포함되어 커밋되지 않습니다.`,
    '>',
    `> ⚠ **변수명에 ${B}VITE_${B} 를 붙이지 마세요.** 붙이면 인증키가 클라이언트 번들에 포함되어`,
    '> 브라우저 네트워크 탭에 그대로 노출됩니다. 이 변수는 프록시(서버)에서만 읽습니다.',
    `> 실수로 ${B}VITE_${B} 를 붙이면 개발 서버 시작 시 보안 경고가 출력됩니다.`,
  ].join('\n'),
)
m = m.replace(
  `| ${B}AIRKOREA_SERVICE_KEY${B} | (없음) | 공공데이터포털 **Decoding** 인증키 |`,
  `| ${B}AIRKOREA_SERVICE_KEY${B} | (없음) | 공공데이터포털 **Decoding** 인증키 · VITE_ 접두사 금지(서버 전용) |`,
)
write('09_사용자매뉴얼.md', m)

/* ---------------- 03 API연동명세서 ---------------- */
let p = read('03_API연동명세서.md')
p = p.replace(
  `| 인증키 보관 | ${B}app/.env.local${B} → ${B}VITE_AIRKOREA_SERVICE_KEY${B} (**값은 본 문서에 기재하지 않음**) |`,
  `| 인증키 보관 | ${B}app/.env.local${B} → ${B}AIRKOREA_SERVICE_KEY${B} (서버 전용, **값은 본 문서에 기재하지 않음**) |`,
)
p = p.replace(
  `| ${B}serviceKey${B} | ✅ | (Decoding 키) | 인증키 |`,
  `| ${B}serviceKey${B} | ✅ | (Decoding 키) | 인증키 — **프록시가 서버에서 주입**. 브라우저 요청에는 포함되지 않음 |`,
)
p = p.replace(
  `- 본 앱은 ${B}URLSearchParams${B} 로 1회 인코딩하므로 **Decoding 키**를 넣어야 합니다.`,
  `- 본 앱은 프록시에서 ${B}URLSearchParams${B} 로 1회 인코딩하므로 **Decoding 키**를 넣어야 합니다.`,
)
p = p.replace(
  '| 타임아웃 | 15초 | 실측 응답시간 5~7초, 여유 2배 |',
  '| 타임아웃 | 클라이언트 15초 / 프록시 20초 | 실측 응답시간 5~7초, 여유 2~3배 |',
)
write('03_API연동명세서.md', p)

/* ---------------- 10 트러블슈팅 — 이슈 2건 추가 ---------------- */
let t = read('10_트러블슈팅_이슈로그.md')
const addendum = [
  '',
  '---',
  '',
  '## ISSUE-13 · 인증키가 브라우저 요청에 노출됨',
  '',
  '**증상** DevTools 네트워크 탭에서 요청 URL 확인 중 발견.',
  '',
  '```',
  '/openapi/B552584/ArpltnStatsSvc/getMsrstnAcctoRDyrg?serviceKey=<키 전문 노출>&returnType=json&...',
  '```',
  '',
  `**원인** 환경변수를 ${B}VITE_AIRKOREA_SERVICE_KEY${B} 로 둬서 Vite 가 클라이언트 번들에 인라인했고,`,
  '클라이언트가 직접 쿼리스트링에 실어 보내고 있었습니다.',
  '이 구조에서는 네트워크 탭뿐 아니라 **브라우저 히스토리 · Referer 헤더 · 프록시 접근 로그**에도 키가 남습니다.',
  '',
  '**조치**',
  '',
  `1. 환경변수에서 ${B}VITE_${B} 접두사 제거 → ${B}AIRKOREA_SERVICE_KEY${B} (서버 전용)`,
  `2. Vite 프록시의 ${B}rewrite${B} 단계에서 키를 주입 (클라이언트가 보낸 값은 덮어씀)`,
  `3. 클라이언트에는 ${B}define${B} 으로 **설정 여부 boolean 만** 전달`,
  `4. 실수 방지 — ${B}VITE_${B} 접두사 변수를 쓰면 개발 서버 시작 시 보안 경고 출력`,
  '',
  '**검증**',
  '',
  '```bash',
  '$ grep -r "$KEY" dist/              →  결과 없음',
  '$ grep -r "serviceKey" dist/assets/ →  결과 없음',
  '```',
  '',
  '네트워크 탭 재확인 — 5건 전부 200, URL 에 serviceKey 없음.',
  '',
  '**교훈** 프런트엔드 단독 구조에서는 "환경변수니까 안전하다"가 성립하지 않습니다.',
  'VITE_ 접두사는 *공개해도 되는 값*을 위한 것이고, 비밀값은 서버를 거쳐야 합니다.',
  '',
  '---',
  '',
  '## ISSUE-14 · 첫 화면 로딩이 19초',
  '',
  '**증상** API 장애 구간에서 통계 화면 첫 진입이 19초가량 걸림.',
  '',
  '**원인** ISSUE-09 에서 "폴백 전 1회 재시도"를 넣었는데, **타임아웃·504 에도 재시도**하고 있었습니다.',
  '이미 15초를 기다린 뒤 다시 15초를 기다리는 구조라 대기가 두 배가 됐습니다.',
  '',
  '**조치** 재시도 조건을 좁혔습니다.',
  '',
  '| 상황 | 재시도 | 이유 |',
  '|---|---|---|',
  '| 0건 응답 | ✅ | 같은 요청에 정상이 오기도 함. 응답 자체는 빨랐음 |',
  '| SERVICETIMEOUT(05) | ✅ | 즉시 떨어지는 오류라 재시도 비용이 낮음 |',
  '| 클라이언트 타임아웃 | ✖ | 이미 15초 대기. 한 번 더 하면 30초 |',
  '| 프록시 504 / 네트워크 | ✖ | 동일 |',
  '| 인증 오류(20/30) | ✖ | 결과가 바뀌지 않음 |',
  '',
  '**교훈** 재시도는 "실패했으니 한 번 더"가 아니라',
  '**"재시도 비용 < 성공 기댓값"일 때만** 넣어야 합니다.',
  '',
].join('\n')

const marker = '## 참고 · 앞으로 확인이 필요한 항목'
if (t.includes(marker)) {
  t = t.replace(marker, addendum.trimStart() + '\n' + marker)
} else {
  t += addendum
}
t = t.replace(
  '| 인쇄 PDF 실제 출력물 | **미확인** (CSS만 작성) |',
  '| 인쇄 PDF 실제 출력물 | **미확인** (CSS만 작성) |\n| 배포 환경 리버스 프록시 키 주입 | **미확인** (개발 서버 프록시만 검증) |',
)
write('10_트러블슈팅_이슈로그.md', t)

console.log('문서 갱신 완료: 03 / 04 / 09 / 10')

/* ---------------- 잔여 VITE_AIRKOREA 참조 확인 ---------------- */
for (const f of fs.readdirSync(P).filter((x) => x.endsWith('.md'))) {
  const s = read(f)
  if (s.includes('VITE_AIRKOREA_SERVICE_KEY')) {
    const n = s.split('VITE_AIRKOREA_SERVICE_KEY').length - 1
    console.log(`  · ${f}: VITE_AIRKOREA_SERVICE_KEY 언급 ${n}건 (의도된 '변경 전' 설명인지 확인 필요)`)
  }
}
