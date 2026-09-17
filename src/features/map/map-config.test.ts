import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CENTER,
  DEFAULT_RADIUS_M,
  MAPBOX_TOKEN,
  computeHasMapboxToken,
  hasMapboxToken,
  resolveDefaultCenter,
  resolveMapStyleUrl,
} from '@/features/map/map-config'

/**
 * Vite loads `.env.local` into the Vitest run too, so `VITE_MAPBOX_TOKEN`
 * and `VITE_MAP_DEFAULT_LAT`/`LNG` may or may not be set depending on who
 * is running the suite. The module-level exports therefore assert only that
 * they are *wired* to the pure resolvers over the ambient env — pinning them
 * to the "unset" result made the suite fail the moment a developer
 * provisioned a real token locally.
 *
 * The env-driven logic itself lives in pure functions
 * (`computeHasMapboxToken`, `resolveDefaultCenter`) so both branches stay
 * directly testable without stubbing `import.meta.env`.
 */
describe('hasMapboxToken', () => {
  it('is derived from the ambient VITE_MAPBOX_TOKEN', () => {
    expect(hasMapboxToken).toBe(computeHasMapboxToken(MAPBOX_TOKEN))
  })

  it('computeHasMapboxToken(undefined) is false', () => {
    expect(computeHasMapboxToken(undefined)).toBe(false)
  })

  it('computeHasMapboxToken("") is false', () => {
    expect(computeHasMapboxToken('')).toBe(false)
  })

  it('computeHasMapboxToken("pk.abc123") is true', () => {
    expect(computeHasMapboxToken('pk.abc123')).toBe(true)
  })
})

describe('resolveDefaultCenter', () => {
  it('falls back to the Medellín default when no env override is given', () => {
    const center = resolveDefaultCenter(undefined, undefined)
    expect(center).toEqual({ lat: 6.2234, lng: -75.5802 })
  })

  it('uses the env override when both lat and lng are valid numeric strings', () => {
    expect(resolveDefaultCenter('4.7110', '-74.0721')).toEqual({ lat: 4.711, lng: -74.0721 })
  })

  it('falls back to the default when only one of lat/lng is set', () => {
    expect(resolveDefaultCenter('4.7110', undefined)).toEqual({ lat: 6.2234, lng: -75.5802 })
  })

  it('falls back to the default when an override is not a valid number', () => {
    expect(resolveDefaultCenter('not-a-number', '-74.0721')).toEqual({ lat: 6.2234, lng: -75.5802 })
  })
})

describe('module-level DEFAULT_CENTER', () => {
  it('is derived from the ambient VITE_MAP_DEFAULT_LAT/LNG', () => {
    expect(DEFAULT_CENTER).toEqual(
      resolveDefaultCenter(
        import.meta.env.VITE_MAP_DEFAULT_LAT,
        import.meta.env.VITE_MAP_DEFAULT_LNG
      )
    )
  })
})

describe('DEFAULT_RADIUS_M', () => {
  it('equals 5000 — confirmed against GetNearbyPlacesQueryHandler.cs DefaultRadiusMeters', () => {
    expect(DEFAULT_RADIUS_M).toBe(5000)
  })
})

describe('resolveMapStyleUrl', () => {
  it('resolves the light theme to the stock streets style', () => {
    expect(resolveMapStyleUrl('light')).toBe('mapbox://styles/mapbox/streets-v12')
  })

  it('resolves the dark theme to the stock dark style', () => {
    expect(resolveMapStyleUrl('dark')).toBe('mapbox://styles/mapbox/dark-v11')
  })
})
