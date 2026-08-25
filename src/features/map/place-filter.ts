import type { NearbyPlace } from '@/shared/schemas/places'

/**
 * WU003b (map discovery) — client-side list filter (design decision #3):
 * `GET /places/nearby` has no free-text query parameter, so "search" here
 * is a pure filter over the already-fetched results, never a new request.
 */

/** Lowercase + strip diacritics (NFD normalize, drop combining marks). */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Case-insensitive, accent-insensitive substring match over `name`. */
export function filterPlaces(places: NearbyPlace[], query: string): NearbyPlace[] {
  const normalizedQuery = normalizeText(query)
  if (normalizedQuery === '') {
    return places
  }
  return places.filter((place) => normalizeText(place.name).includes(normalizedQuery))
}

/**
 * Formats a raw `distanceMeters` value (observed live with ~8 decimal
 * places, e.g. `1151.80798524`) for display (design decision #13). Under
 * 1000m: whole meters. At or above 1000m: kilometers with 1 decimal.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}
