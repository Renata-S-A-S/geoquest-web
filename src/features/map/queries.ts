import { useQuery } from '@tanstack/react-query'
import { getNearbyPlaces } from '@/features/map/places-api'

/**
 * WU003b (map discovery) — TanStack Query wiring around `places-api.ts`.
 * Mirrors `features/gamification/queries.ts`'s centralized-key convention.
 */

/**
 * Coordinates are rounded to 4 decimals (~11m precision) before entering
 * the query key (design doc decision #7) — raw GPS jitter would otherwise
 * refetch on every reading.
 */
function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000
}

export const placesKeys = {
  nearby: (lat: number, lng: number, radiusM: number, category: number | undefined) =>
    ['places', 'nearby', roundCoord(lat), roundCoord(lng), radiusM, category] as const,
}

export interface UseNearbyPlacesParams {
  lat: number
  lng: number
  radiusM: number
  category?: number
  enabled?: boolean
}

export function useNearbyPlaces({ lat, lng, radiusM, category, enabled }: UseNearbyPlacesParams) {
  return useQuery({
    queryKey: placesKeys.nearby(lat, lng, radiusM, category),
    queryFn: () => getNearbyPlaces({ lat, lng, radiusM, category }),
    enabled: enabled ?? true,
  })
}
