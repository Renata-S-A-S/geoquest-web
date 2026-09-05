import { useMutation, useQuery } from '@tanstack/react-query'
import { getPlaceById } from '@/features/routes/place-detail-api'
import { getRouteById, getRouteProgress, getRoutes, startRoute } from '@/features/routes/routes-api'

/** Rutas — TanStack Query wiring around `routes-api.ts`. Mirrors `features/gamification/queries.ts`. */
export function useStartRoute() {
  return useMutation({
    mutationFn: (routeId: string) => startRoute(routeId),
  })
}

/**
 * Read-layer query keys (004-routes-read-endpoints, Slice B/C). `detail`/
 * `progress` are per-`routeId` functions (mirrors `placeDetailKeys.detail`
 * below), `list` has no parameters (mirrors `gamificationKeys.profile`).
 */
export const routesKeys = {
  list: ['routes', 'list'] as const,
  detail: (routeId: string) => ['routes', 'detail', routeId] as const,
  progress: (routeId: string) => ['routes', 'progress', routeId] as const,
}

/** `GET /routes` — the published route catalog (routes-page consumer arrives in slice 3). */
export function useRoutes() {
  return useQuery({
    queryKey: routesKeys.list,
    queryFn: getRoutes,
  })
}

/** `GET /routes/{id}` — embeds the explorer's own `myProgress` (design DD1). `enabled` only once a `routeId` is set, mirrors `usePlaceDetail`. */
export function useRouteDetail(routeId: string | undefined) {
  return useQuery({
    queryKey: routesKeys.detail(routeId ?? ''),
    queryFn: () => getRouteById(routeId as string),
    enabled: Boolean(routeId),
  })
}

/** `GET /routes/{id}/progress` — resolves to `null` for "never started" (not an error), never throws for that case. */
export function useRouteProgress(routeId: string | undefined) {
  return useQuery({
    queryKey: routesKeys.progress(routeId ?? ''),
    queryFn: () => getRouteProgress(routeId as string),
    enabled: Boolean(routeId),
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
