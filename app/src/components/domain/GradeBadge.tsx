import { GRADE_BG_VAR, GRADE_CSS_VAR, GRADE_ICON, GRADE_LABEL } from '../../lib/grade'
import type { GradeLevel } from '../../lib/types'

/**
 * 대기질 등급 표시.
 *
 * ⚠ 접근성 규칙 — 등급을 '색만으로' 표현하지 않는다.
 *   미세먼지 4등급 관례색(파랑/초록/주황/빨강)은 적록 색각에서
 *   빨강↔초록 ΔE 4.1, 빨강↔주황 ΔE 13.5 로 구분 한계 미만이다.
 *   따라서 이 컴포넌트는 항상 [기호 + 한글 등급명] 을 함께 렌더링하며,
 *   색은 보조 채널로만 쓴다. (검증 근거: 산출물/06 문서)
 */
export default function GradeBadge({
  grade,
  size = 'md',
  showIcon = true,
}: {
  grade: GradeLevel
  size?: 'sm' | 'md'
  showIcon?: boolean
}) {
  return (
    <span
      className="badge"
      style={{
        color: GRADE_CSS_VAR[grade],
        background: GRADE_BG_VAR[grade],
        padding: size === 'sm' ? '2px 6px' : '4px 9px',
        fontSize: size === 'sm' ? 11 : 12,
      }}
    >
      {showIcon && <span aria-hidden>{GRADE_ICON[grade]}</span>}
      {GRADE_LABEL[grade]}
    </span>
  )
}

/** 리스트/차트 범례에서 쓰는 점 + 라벨 형태 */
export function GradeLegend({ grades = [1, 2, 3, 4] as GradeLevel[] }: { grades?: GradeLevel[] }) {
  return (
    <ul className="row gap-12" style={{ flexWrap: 'wrap' }}>
      {grades.map((g) => (
        <li key={g} className="row gap-4">
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: GRADE_CSS_VAR[g],
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            {GRADE_LABEL[g]}
          </span>
        </li>
      ))}
    </ul>
  )
}
