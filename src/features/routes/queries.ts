import { useMutation, useQuery } from '@tanstack/react-query'
import { getPlaceById } from '@/features/routes/place-detail-api'
import { startRoute } from '@/features/routes/routes-api'

/** Rutas — TanStack Query wiring around `routes-api.ts`. Mirrors `features/gamification/queries.ts`. */
export function useStartRoute() {
  return useMutation({
    mutationFn: (routeId: string) => startRoute(routeId),
  })
}

export const placeDetailKeys = {
  detail: (placeId: string) => ['places', 'detail', placeId] as const,
}

/**
 * Rutas stop detail — TanStack Query wiring around `place-detail-api.ts`.
 * `enabled` only when a `placeId` is set, so the query stays idle until a
 * stop is actually tapped (mirrors `useNearbyPlaces`'s `enabled` param).
 */
export function usePlaceDetail(placeId: string | undefined) {
  return useQuery({
    queryKey: placeDetailKeys.detail(placeId ?? ''),
    queryFn: () => getPlaceById(placeId as string),
    enabled: Boolean(placeId),
  })
}
