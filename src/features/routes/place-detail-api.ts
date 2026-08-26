import { apiClient } from '@/shared/lib/api-client'
import { placeDetailSchema, type PlaceDetail } from '@/shared/schemas/places'

/**
 * Rutas stop detail — read transport for `GET /places/{id}`. Mirrors
 * `features/map/places-api.ts`'s `getNearbyPlaces`: Zod parse out only, calls
 * go through the shared `apiClient` singleton (WU6 interceptors reused).
 *
 * Added so tapping a stop in `RouteDetailModal` can show the same rich place
 * card as the map's `SelectedPlaceCard` — a route stop is a bare `PlaceId`
 * with no proximity context, so `GET /places/nearby` doesn't fit; this is a
 * direct by-ID lookup instead.
 */
export async function getPlaceById(placeId: string): Promise<PlaceDetail> {
  const { data } = await apiClient.get(`/places/${placeId}`)
  return placeDetailSchema.parse(data)
}
