import { Banner } from '../ui'
import { timeAgo } from '../../lib/date'
import type { Dataset } from '../../lib/types'

/**
 * 데이터 출처 표기.
 * 화면에 보이는 숫자가 실측인지 데모인지 사용자가 항상 알 수 있어야 한다.
 */
export function SourceNotice({ ds }: { ds?: Dataset<unknown> }) {
  if (!ds || ds.source === 'live') return null
  return (
    <Banner tone="warn">
      <b>데모 데이터</b>
      {ds.note ? ` · ${ds.note}` : ' · 공공데이터 인증키가 설정되지 않아 합성 데이터로 표시 중입니다.'}
    </Banner>
  )
}

/** 상단/하단에 작게 붙이는 출처·갱신시각 한 줄 */
export function SourceLine({ ds }: { ds?: Dataset<unknown> }) {
  if (!ds) return null
  const label = ds.source === 'live' ? '에어코리아(한국환경공단) 실시간 자료' : '데모 데이터(합성)'
  return (
    <p className="t-caption c-tertiary" style={{ wordBreak: 'keep-all' }}>
      출처 · {label} · {timeAgo(new Date(ds.fetchedAt))} 기준
    </p>
  )
}
