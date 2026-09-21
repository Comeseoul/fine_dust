import { useQuery } from '@tanstack/react-query'
import {
  fetchDaily,
  fetchForecast,
  fetchHourly,
  fetchNationwide,
  fetchSidoStations,
  fetchStations,
  runDiagnostics,
} from '../api/airkorea'

/** 실시간 계열은 1시간 단위로 갱신되므로 캐시를 5분만 신선하게 본다. */
const REALTIME = { staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
/** 확정 이력/통계는 하루 단위로 바뀌므로 길게 잡는다. */
const HISTORICAL = { staleTime: 60 * 60_000, gcTime: 6 * 60 * 60_000 }

export function useStations(sido: string) {
  return useQuery({
    queryKey: ['stations', sido],
    queryFn: () => fetchStations(sido),
    ...HISTORICAL,
  })
}

export function useSidoStations(sido: string) {
  return useQuery({
    queryKey: ['sido-stations', sido],
    queryFn: () => fetchSidoStations(sido),
    ...REALTIME,
  })
}

export function useHourly(sido: string, station: string, term: 'DAILY' | 'MONTH' | '3MONTH' = 'DAILY') {
  return useQuery({
    queryKey: ['hourly', sido, station, term],
    queryFn: () => fetchHourly(sido, station, term),
    enabled: Boolean(station),
    ...REALTIME,
  })
}

export function useNationwide() {
  return useQuery({
    queryKey: ['nationwide'],
    queryFn: fetchNationwide,
    ...REALTIME,
  })
}

export function useDaily(sido: string, station: string, from: string, to: string) {
  return useQuery({
    queryKey: ['daily', sido, station, from, to],
    queryFn: () => fetchDaily(sido, station, from, to),
    enabled: Boolean(station && from && to),
    ...HISTORICAL,
  })
}

export function useForecast() {
  return useQuery({
    queryKey: ['forecast'],
    queryFn: fetchForecast,
    ...REALTIME,
  })
}

export function useDiagnostics(enabled: boolean) {
  return useQuery({
    queryKey: ['diagnostics'],
    queryFn: runDiagnostics,
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}
