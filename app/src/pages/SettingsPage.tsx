import { useState } from 'react'
import TopBar from '../components/layout/TopBar'
import { RegionSheet } from '../components/domain/RegionPicker'
import { GradeLegend } from '../components/domain/GradeBadge'
import { Banner, Button, Card, ListRow, Section, Segmented, Skeleton } from '../components/ui'
import { useDiagnostics } from '../hooks/useAirData'
import { useSettings, type ThemePref } from '../store/SettingsContext'
import { HAS_KEY, SKIP_CALL_WITHOUT_KEY, SOURCE_MODE } from '../lib/config'
import type { DiagnosticResult } from '../lib/types'
import './pages.css'

export default function SettingsPage() {
  const { sido, station, theme, setTheme, cvdSafe, setCvdSafe, pollutant, setPollutant } = useSettings()
  const [regionOpen, setRegionOpen] = useState(false)
  const [diagOn, setDiagOn] = useState(false)
  const diag = useDiagnostics(diagOn)

  return (
    <>
      <TopBar title="설정" />

      <div className="page">
        {/* ---- 지역 -------------------------------------------------------- */}
        <Section title="기본 지역">
          <div className="list">
            <ListRow
              title="관심 지역"
              sub="앱을 열 때 기본으로 보여줄 지역입니다"
              right={<span className="t-label c-tertiary">{sido}{station ? ` · ${station}` : ''}</span>}
              onClick={() => setRegionOpen(true)}
            />
          </div>
        </Section>

        {/* ---- 표시 -------------------------------------------------------- */}
        <Section title="표시">
          <Card className="stack gap-20">
            <div className="stack gap-8">
              <span className="t-label c-secondary">기본 측정 항목</span>
              <Segmented
                label="기본 측정 항목"
                options={[
                  { value: 'pm25', label: 'PM2.5 초미세먼지' },
                  { value: 'pm10', label: 'PM10 미세먼지' },
                ]}
                value={pollutant}
                onChange={setPollutant}
              />
            </div>

            <div className="stack gap-8">
              <span className="t-label c-secondary">테마</span>
              <Segmented
                label="테마"
                options={[
                  { value: 'system', label: '시스템' },
                  { value: 'light', label: '라이트' },
                  { value: 'dark', label: '다크' },
                ]}
                value={theme}
                onChange={(v) => setTheme(v as ThemePref)}
              />
            </div>

            <div className="row between gap-16">
              <div className="grow">
                <div className="t-bodyB">색각 보조 모드</div>
                <p className="t-caption c-tertiary" style={{ marginTop: 2, wordBreak: 'keep-all' }}>
                  등급 색(파랑·초록·주황·빨강)은 적록 색각에서 구분이 어렵습니다. 켜면 명도 차만으로
                  읽히는 단일 색상 단계로 바뀝니다.
                </p>
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={cvdSafe}
                aria-label="색각 보조 모드"
                onClick={() => setCvdSafe(!cvdSafe)}
              />
            </div>

            <div className="stack gap-8">
              <span className="t-label c-secondary">현재 등급 색</span>
              <GradeLegend />
            </div>
          </Card>
        </Section>

        {/* ---- 데이터 연결 --------------------------------------------------- */}
        <Section title="공공데이터 연결" desc="에어코리아 오픈 API 상태를 직접 확인합니다">
          <Card className="stack gap-12">
            <dl className="report__kv">
              <dt>인증키</dt>
              <dd>
                {HAS_KEY
                  ? '설정됨'
                  : SKIP_CALL_WITHOUT_KEY
                    ? '없음'
                    : '서버에서 확인 (연결 진단 실행)'}
              </dd>
              <dt>데이터 모드</dt>
              <dd>
                {SOURCE_MODE === 'auto'
                  ? '자동 (실데이터 우선, 실패 시 데모)'
                  : SOURCE_MODE === 'live'
                    ? '실데이터 고정'
                    : '데모 고정'}
              </dd>
            </dl>

            {SKIP_CALL_WITHOUT_KEY ? (
              <Banner tone="warn">
                인증키가 없어 데모 데이터로 동작 중입니다. <code>app/.env.local</code> 의{' '}
                <code>AIRKOREA_SERVICE_KEY</code> 에 공공데이터포털 Decoding 인증키를 넣고 개발
                서버를 다시 시작해 주세요.
              </Banner>
            ) : !HAS_KEY ? (
              <Banner tone="info">
                인증키는 서버(프록시)에만 있으므로 브라우저에서는 설정 여부를 알 수 없습니다.
                아래 <b>연결 진단</b>으로 실제 상태를 확인해 주세요.
              </Banner>
            ) : null}

            <Button variant="secondary" block onClick={() => { setDiagOn(true); diag.refetch() }}>
              연결 진단 실행
            </Button>

            {diagOn && (
              <div className="diag">
                {diag.isFetching ? (
                  <>
                    <Skeleton h={44} r={10} />
                    <Skeleton h={44} r={10} />
                  </>
                ) : (
                  (diag.data ?? []).map((r) => <DiagRow key={r.endpoint} r={r} />)
                )}
              </div>
            )}

            {diagOn && !diag.isFetching && (diag.data ?? []).some((r) => r.status === 'AUTH_OK_NO_DATA') && (
              <Banner tone="info">
                인증은 통과했지만 데이터가 0건입니다. 공공데이터포털 활용신청 직후에는 데이터 접근
                권한 반영에 최대 1시간이 걸립니다. 잠시 후 다시 진단해 주세요.
              </Banner>
            )}
          </Card>
        </Section>

        {/* ---- 정보 -------------------------------------------------------- */}
        <Section title="앱 정보">
          <Card className="stack gap-8">
            <dl className="report__kv">
              <dt>데이터 출처</dt>
              <dd>한국환경공단 에어코리아</dd>
              <dt>판정 기준</dt>
              <dd>환경부 대기환경기준 4단계</dd>
              <dt>디자인</dt>
              <dd>TDS Mobile 참조</dd>
            </dl>
            <p className="t-caption c-tertiary" style={{ wordBreak: 'keep-all' }}>
              측정값은 확정 전 자료를 포함할 수 있어 추후 정정될 수 있습니다. 공식 수치는 에어코리아
              누리집을 확인해 주세요.
            </p>
          </Card>
        </Section>
      </div>

      <RegionSheet open={regionOpen} onClose={() => setRegionOpen(false)} />
    </>
  )
}

const STATUS_STYLE: Record<DiagnosticResult['status'], { color: string; label: string }> = {
  OK: { color: 'var(--positive)', label: '정상' },
  AUTH_OK_NO_DATA: { color: 'var(--caution)', label: '데이터 0건' },
  AUTH_FAIL: { color: 'var(--negative)', label: '인증 실패' },
  SERVER: { color: 'var(--caution)', label: '서버 오류' },
  NETWORK: { color: 'var(--negative)', label: '연결 실패' },
}

function DiagRow({ r }: { r: DiagnosticResult }) {
  const s = STATUS_STYLE[r.status]
  return (
    <div className="diag__row">
      <span className="diag__dot" style={{ background: s.color }} aria-hidden />
      <div className="grow">
        <div className="diag__name">
          {r.name} <span style={{ color: s.color }}>· {s.label}</span>
        </div>
        <p className="diag__msg">{r.message}</p>
      </div>
      <span className="diag__ms">{r.ms}ms</span>
    </div>
  )
}
