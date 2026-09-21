import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import NowPage from './pages/NowPage'
import { Card, Skeleton } from './components/ui'

/** 차트 라이브러리를 쓰는 화면은 진입 시점에 로드한다.
 *  첫 화면(현황)은 즉시 필요하므로 정적 import 로 남긴다. */
const StatsPage = lazy(() => import('./pages/StatsPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function RouteFallback() {
  return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Skeleton h={24} w={140} />
        <div style={{ height: 14 }} />
        <Skeleton h={64} r={12} />
      </Card>
      <Card>
        <Skeleton h={200} r={12} />
      </Card>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<NowPage />} />
        <Route
          path="stats"
          element={
            <Suspense fallback={<RouteFallback />}>
              <StatsPage />
            </Suspense>
          }
        />
        <Route
          path="history"
          element={
            <Suspense fallback={<RouteFallback />}>
              <HistoryPage />
            </Suspense>
          }
        />
        <Route
          path="report"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ReportPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<RouteFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
