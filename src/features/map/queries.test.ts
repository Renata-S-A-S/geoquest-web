import { describe, expect, it } from 'vitest'
import { placesKeys } from '@/features/map/queries'

/**
 * `placesKeys.nearby` rounds coordinates to 4 decimals (design doc decision
 * #7) — raw GPS jitter (a new reading every few seconds) would otherwise
 * refetch `useNearbyPlaces` on every render.
 */
describe('placesKeys.nearby', () => {
  it('rounds lat/lng to 4 decimals', () => {
    expect(placesKeys.nearby(6.223456789, -75.580212345, 5000, undefined)).toEqual([
      'places',
      'nearby',
      6.2235,
      -75.5802,
      5000,
      undefined,
    ])
  })

  it('produces the same key for two readings that only differ past the 4th decimal (GPS jitter guard)', () => {
    const keyA = placesKeys.nearby(6.223401, -75.580201, 5000, undefined)
    const keyB = placesKeys.nearby(6.223409, -75.580209, 5000, undefined)
    expect(keyA).toEqual(keyB)
  })

  it('includes category in the key when provided, producing a different key than without it', () => {
    const withoutCategory = placesKeys.nearby(6.2234, -75.5802, 5000, undefined)
    const withCategory = placesKeys.nearby(6.2234, -75.5802, 5000, 4)
    expect(withCategory).not.toEqual(withoutCategory)
    expect(withCategory).toEqual(['places', 'nearby', 6.2234, -75.5802, 5000, 4])
  })
})
