import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CENTER,
  DEFAULT_RADIUS_M,
  MAP_STYLE_URL,
  computeHasMapboxToken,
  hasMapboxToken,
  resolveDefaultCenter,
} from '@/features/map/map-config'

/**
 * `VITE_MAPBOX_TOKEN`/`VITE_MAP_DEFAULT_LAT`/`VITE_MAP_DEFAULT_LNG` are not
 * set in this test run (no `.env.test` overrides them), so the module-level
 * exports exercise the "unset" default path — mirrors
 * `checkin-config.test.ts`'s "no env override set in this test run" note.
 * The env-driven resolution logic itself is extracted into pure functions
 * (`computeHasMapboxToken`, `resolveDefaultCenter`) so both branches are
 * directly testable without stubbing `import.meta.env`.
 */
describe('hasMapboxToken', () => {
  it('is false in this test run (VITE_MAPBOX_TOKEN unset)', () => {
    expect(hasMapboxToken).toBe(false)
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
  it('resolves to the Medellín fallback in this test run (no env override set)', () => {
    expect(DEFAULT_CENTER).toEqual({ lat: 6.2234, lng: -75.5802 })
  })
})

describe('DEFAULT_RADIUS_M', () => {
  it('equals 5000 — confirmed against GetNearbyPlacesQueryHandler.cs DefaultRadiusMeters', () => {
    expect(DEFAULT_RADIUS_M).toBe(5000)
  })
})

describe('MAP_STYLE_URL', () => {
  it('is a stock Mapbox style, not a custom brand-token style', () => {
    expect(MAP_STYLE_URL).toBe('mapbox://styles/mapbox/streets-v12')
  })
})
