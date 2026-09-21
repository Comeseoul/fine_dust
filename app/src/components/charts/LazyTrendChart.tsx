import { Suspense, lazy, type ComponentProps } from 'react'
import { Skeleton } from '../ui'

/** recharts 는 무거우므로 첫 화면 번들에서 떼어낸다. */
const TrendChart = lazy(() => import('./TrendChart'))

export type { TrendPoint } from './TrendChart'

export default function LazyTrendChart(props: ComponentProps<typeof TrendChart>) {
  return (
    <Suspense
      fallback={
        <div className="chartcard">
          <Skeleton h={18} w={120} />
          <div style={{ height: 14 }} />
          <Skeleton h={props.height ?? 200} r={12} />
        </div>
      }
    >
      <TrendChart {...props} />
    </Suspense>
  )
}
