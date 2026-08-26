/**
 * WU003b (map discovery) — Mapbox token resolution, stock map style, and
 * default center/radius. `VITE_MAPBOX_TOKEN` is user-provisioned and not
 * yet set in `.env.local` (proposal doc, scope item 6) — the app must
 * degrade to list-only mode, not crash, when it's absent (design decision
 * #5). The env-driven resolution logic is extracted into pure functions
 * (`computeHasMapboxToken`, `resolveDefaultCenter`) so both branches are
 * directly unit-testable without stubbing `import.meta.env`.
 */

import type { ResolvedTheme } from '@/shared/lib/theme'

export const MAPBOX_TOKEN: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN

export function computeHasMapboxToken(token: string | undefined): boolean {
  return Boolean(token && token.length > 0)
}

export const hasMapboxToken = computeHasMapboxToken(MAPBOX_TOKEN)

/** Stock styles (design confirmed decision 2, proposal) — not custom brand-token styles. */
export const MAP_STYLE_URLS: Record<ResolvedTheme, string> = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
}

export function resolveMapStyleUrl(theme: ResolvedTheme): string {
  return MAP_STYLE_URLS[theme]
}

export interface Coordinates {
  lat: number
  lng: number
}

/**
 * Medellín fallback — matches "El Cielo", a real seeded place confirmed
 * against the running dev backend (lat 6.2234 / lng -75.5802), so the
 * fallback center sits inside the actual seeded-places cluster rather than
 * an arbitrary unverified point.
 */
const FALLBACK_CENTER: Coordinates = { lat: 6.2234, lng: -75.5802 }

/** `VITE_MAP_DEFAULT_LAT`/`VITE_MAP_DEFAULT_LNG` override, or the Medellín fallback. */
export function resolveDefaultCenter(
  latEnv: string | undefined,
  lngEnv: string | undefined
): Coordinates {
  if (latEnv === undefined || lngEnv === undefined) {
    return FALLBACK_CENTER
  }
  const lat = Number(latEnv)
  const lng = Number(lngEnv)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return FALLBACK_CENTER
  }
  return { lat, lng }
}

export const DEFAULT_CENTER = resolveDefaultCenter(
  import.meta.env.VITE_MAP_DEFAULT_LAT,
  import.meta.env.VITE_MAP_DEFAULT_LNG
)

/**
 * Confirmed against `GetNearbyPlacesQueryHandler.cs:22-28`:
 * `DefaultRadiusMeters = 5000`, `MaxRadiusMeters = 25000` (truncates,
 * never rejects with 400).
 */
export const DEFAULT_RADIUS_M = 5000
