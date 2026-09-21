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

| 변수 | 기본값 | 설명 |
|---|---|---|
| `VITE_AIRKOREA_SERVICE_KEY` | — | 공공데이터포털 **Decoding** 인증키 |
| `VITE_DATA_SOURCE` | `auto` | `auto` / `live` / `mock` |
| `VITE_DEFAULT_SIDO` | `서울` | 기본 시도 |
| `VITE_API_TIMEOUT` | `15000` | 타임아웃(ms) |

`.env.local` 은 `.gitignore` 에 포함되어 커밋되지 않습니다.

---

## 배포 시 주의

`apis.data.go.kr` 은 CORS 헤더를 주지 않습니다. 앱은 항상 상대 경로 `/openapi` 로
호출하므로, 배포 환경에서 이 경로를 리버스 프록시로 연결해야 합니다.

```nginx
location /openapi/ {
    proxy_pass https://apis.data.go.kr/;
    proxy_set_header Host apis.data.go.kr;
    proxy_ssl_server_name on;
}
```

> 현재 구조는 인증키가 프런트엔드 번들에 포함됩니다. 실제 운영 배포 시에는
> 인증키를 서버에서 주입하는 BFF 구조로 전환하는 것을 권장합니다.

---

## 데이터 출처

한국환경공단 **에어코리아** (공공데이터포털)
판정 기준: 환경부 대기환경기준 4단계

측정값은 확정 전 자료를 포함할 수 있어 추후 정정될 수 있습니다.
