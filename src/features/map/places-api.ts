import { apiClient } from '@/shared/lib/api-client'
import { nearbyPlacesSchema, type NearbyPlace } from '@/shared/schemas/places'

/**
 * WU003b (map discovery) — read transport for `GET /places/nearby`. Mirrors
 * `gamification-api.ts`: Zod parse out only (no request body), calls go
 * through the shared `apiClient` singleton (WU6 interceptors reused).
 */

export interface GetNearbyPlacesParams {
  lat: number
  lng: number
  radiusM?: number
  category?: number
}

/** `GET /places/nearby?lat&lng&radiusM?&category?`. */
export async function getNearbyPlaces(params: GetNearbyPlacesParams): Promise<NearbyPlace[]> {
  const { data } = await apiClient.get('/places/nearby', { params })
  return nearbyPlacesSchema.parse(data)
}
