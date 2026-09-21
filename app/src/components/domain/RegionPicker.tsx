import { useState } from 'react'
import { Chip, ListRow, Sheet, Skeleton } from '../ui'
import { SIDO_LIST } from '../../lib/config'
import { useStations } from '../../hooks/useAirData'
import { useSettings } from '../../store/SettingsContext'

/** 상단바의 지역 선택 버튼 + 바텀시트 */
export default function RegionPicker() {
  const [open, setOpen] = useState(false)
  const { sido, station } = useSettings()

  return (
    <>
      <button className="locbtn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden>📍</span>
        {sido}
        {station ? ` · ${station}` : ''}
        <span className="locbtn__caret" aria-hidden>
          ▾
        </span>
      </button>
      <RegionSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function RegionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sido, station, setSido, setStation } = useSettings()
  const { data, isLoading } = useStations(sido)

  return (
    <Sheet open={open} title="지역 선택" onClose={onClose}>
      <div className="stack gap-20">
        <div className="stack gap-8">
          <h3 className="t-label c-secondary">시 · 도</h3>
          <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
            {SIDO_LIST.map((s) => (
              <Chip key={s} pressed={s === sido} onClick={() => setSido(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>

        <div className="stack gap-8">
          <h3 className="t-label c-secondary">측정소</h3>
          {isLoading ? (
            <div className="stack gap-8">
              <Skeleton h={48} r={12} />
              <Skeleton h={48} r={12} />
              <Skeleton h={48} r={12} />
            </div>
          ) : (
            <div className="list">
              <ListRow
                title="시·도 전체 평균"
                sub={`${sido} 내 전 측정소 평균으로 봅니다`}
                right={station === '' ? <Check /> : undefined}
                chevron={false}
                onClick={() => {
                  setStation('')
                  onClose()
                }}
              />
              {(data?.data ?? []).map((s) => (
                <ListRow
                  key={s.stationName}
                  title={s.stationName}
                  sub={s.addr || s.mangName}
                  right={station === s.stationName ? <Check /> : undefined}
                  chevron={false}
                  onClick={() => {
                    setStation(s.stationName)
                    onClose()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}

/** 선택 표시 — dataviz filter 규격: 16px 굵은 체크 */
function Check() {
  return (
    <span style={{ color: 'var(--blue-500)', fontSize: 16, fontWeight: 800 }} aria-label="선택됨">
      ✓
    </span>
  )
}
