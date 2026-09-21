# 미세먼지 인사이트

에어코리아 공공데이터 기반 **미세먼지 현황 · 통계 · 이력 분석 앱**

React 19 + TypeScript + Vite · 모바일 우선 · TDS(Toss Design System) 참조 UI

> 산출물 문서 일체는 상위 폴더 [`../산출물/`](../산출물/00_산출물_목록.md) 에 있습니다.

---

## 빠른 시작

```bash
npm install
npm run dev     # http://localhost:5173
```

**인증키 없이도 전 기능이 동작합니다.** (데모 데이터 모드)

실데이터를 쓰려면:

```bash
cp .env.example .env.local
# VITE_AIRKOREA_SERVICE_KEY= 에 공공데이터포털 Decoding 인증키 입력 후 서버 재시작
```

발급 절차는 [사용자 매뉴얼 2장](../산출물/09_사용자매뉴얼.md#2-공공데이터-인증키-설정) 참고.

---

## 기능

| 화면 | 내용 |
|---|---|
| **현황** | 대표 등급 · 행동요령 · 24시간 추이 · 측정소 순위 · 전국 비교 · 내일 예보 |
| **통계** | 기간 프리셋(7/30/90일·1년) · 요약 지표 · 자동 인사이트 · 일별 추이 · 등급 분포 · 캘린더 히트맵 · 요일/월별 패턴 |
| **이력** | 임의 기간 조회 · 등급 필터 · 정렬 · 일자 상세 · CSV/JSON 내보내기 |
| **리포트** | 분석 리포트 생성 · 인쇄/PDF 출력 |
| **설정** | 기본 지역 · 테마 · **색각 보조 모드** · **오픈 API 연결 진단** |

---

## 설계상 특징

**1. 실패를 정상 경로로 취급**
인증키가 없든, 활용신청 직후 권한이 아직 반영되지 않았든, 에어코리아 서버가 죽어 있든
앱은 멈추지 않습니다. 데모 데이터로 폴백하되 **화면에 사유를 표시**하고,
권한이 반영되면 코드 수정 없이 자동으로 실데이터로 복귀합니다.

**2. 보는 숫자의 출처가 항상 명시됨**
실측인지 데모인지 사용자가 항상 알 수 있습니다. 상단 배너 + 하단 출처 표기.

**3. 결측을 0으로 채우지 않음**
평균 계산에서 제외하고, 제외 비율을 '자료 수집률'로 별도 노출합니다.

**4. 색만으로 의미를 전달하지 않음**
등급 4색은 색각이상에서 구분이 안 되는 것이 측정으로 확인되었습니다(ΔE 4.1).
기호 + 한글 라벨을 항상 병기하고, **색각 보조 모드**(단일 색상 램프)를 제공하며,
모든 차트에 **표 대체 뷰**가 있습니다. → [검증 보고서](../산출물/06_데이터시각화_검증보고서.md)

---

## 구조

```
src/
├── api/        airkorea.ts  오픈 API 연동 · 실데이터/데모 분기 · 폴백
│               client.ts    HTTP · 오류코드 번역 · 결측 정규화
│               mock.ts      결정론적 데모 데이터 생성기
├── lib/        grade.ts     등급 판정 (환경부 4단계)
│               analytics.ts 집계 · 비교 · 자동 인사이트
│               date/format/export/seed/config/types
├── hooks/      useAirData(React Query) · usePeriod
├── store/      SettingsContext (지역·테마·색각보조)
├── components/ ui · charts · domain · layout
├── pages/      NowPage · StatsPage · HistoryPage · ReportPage · SettingsPage
└── styles/     tokens.css (디자인 토큰) · global.css
```

의존 방향은 단방향입니다 — `lib` 은 아무것도 import 하지 않고,
`pages` 는 `api/client` 를 직접 호출하지 않습니다.

---

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (오픈 API CORS 프록시 포함) |
| `npm run build` | 타입 체크 + 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | oxlint |

---

## 환경변수

| 변수 | 기본값 | 노출 | 설명 |
|---|---|---|---|
| `AIRKOREA_SERVICE_KEY` | — | 서버 전용 | 공공데이터포털 **Decoding** 인증키 |
| `VITE_DATA_SOURCE` | `auto` | 클라이언트 | `auto` / `live` / `mock` |
| `VITE_DEFAULT_SIDO` | `서울` | 클라이언트 | 기본 시도 |
| `VITE_API_TIMEOUT` | `15000` | 클라이언트 | 타임아웃(ms) |

인증키에는 `VITE_` 접두사를 붙이지 않습니다. 붙이면 값이 클라이언트 번들에
포함되어 브라우저에 노출됩니다. 클라이언트에는 `__HAS_SERVICE_KEY__`(설정 여부)만
전달되고, 키 자체는 프록시가 업스트림 호출 시점에만 주입합니다.

`.env.local` 은 `.gitignore` 에 포함되어 커밋되지 않습니다.

---

## 배포

`apis.data.go.kr` 은 CORS 헤더를 주지 않으므로 앱은 항상 상대 경로 `/openapi` 로
호출합니다. 이 경로를 받아 인증키를 주입하는 프록시가 배포 환경에 있어야 합니다.
`vite.config.ts` 의 `server.proxy` 는 `vite dev` 전용이라 빌드 결과물에는 없습니다.

### Vercel

리포지터리에 다음이 포함되어 있어 추가 코드 작업은 필요 없습니다.

| 파일 | 역할 |
|---|---|
| `api/openapi/[...path].ts` | 인증키를 주입하는 서버리스 프록시 (에어코리아 3종 서비스만 허용) |
| `vercel.json` | `/openapi/*` → 프록시 rewrite, SPA fallback, 함수 타임아웃 30초 |

대시보드 설정:

1. **Root Directory** → `app` (리포 루트가 아니라 이 디렉터리)
2. **Framework Preset** → Vite · Build Command `npm run build` · Output Directory `dist`
3. **Environment Variables** → `AIRKOREA_SERVICE_KEY` 등록
   (Production / Preview / Development 모두. `.env.local` 을 커밋하는 방식이 아닙니다)

`AIRKOREA_SERVICE_KEY` 는 빌드 시점(`__HAS_SERVICE_KEY__` 계산)과 런타임(프록시의
키 주입) 양쪽에서 쓰이므로, 등록 후에는 **재배포**해야 반영됩니다.

### 그 외 환경 (nginx 등)

```nginx
location /openapi/ {
    proxy_pass https://apis.data.go.kr/;
    proxy_set_header Host apis.data.go.kr;
    proxy_ssl_server_name on;
    # serviceKey 주입이 필요하므로 단순 pass 만으로는 부족하다.
    # set $svc "<Decoding 키>"; 후 args 에 덧붙이거나 별도 BFF 를 둔다.
}
```

---

## 데이터 출처

한국환경공단 **에어코리아** (공공데이터포털)
판정 기준: 환경부 대기환경기준 4단계

측정값은 확정 전 자료를 포함할 수 있어 추후 정정될 수 있습니다.
