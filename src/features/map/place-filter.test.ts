import { describe, expect, it } from 'vitest'
import { filterPlaces, formatDistance, normalizeText } from '@/features/map/place-filter'
import type { NearbyPlace } from '@/shared/schemas/places'

/** Design doc decision #3 (client-side filter) and #13 (`formatDistance`). */

function place(overrides: Partial<NearbyPlace>): NearbyPlace {
  return {
    placeId: '10000000-0000-0000-0000-000000000019',
    name: 'Avenida El Poblado',
    description: 'Avenida con arte público e instalaciones urbanas.',
    category: 4,
    subcategory: 17,
    latitude: 6.211,
    longitude: -75.571,
    distanceMeters: 1707.9393969,
    pointsReward: 50,
    ...overrides,
  }
}

describe('normalizeText', () => {
  it('lowercases and strips accents (NFD)', () => {
    expect(normalizeText('Pueblito Paisa')).toBe('pueblito paisa')
    expect(normalizeText('Café')).toBe('cafe')
    expect(normalizeText('MAMM')).toBe('mamm')
  })
})

describe('filterPlaces', () => {
  const places = [
    place({ placeId: '1', name: 'Pergamino Café' }),
    place({ placeId: '2', name: 'Pueblito Paisa' }),
    place({ placeId: '3', name: 'MAMM' }),
  ]

  it('returns all places for an empty query', () => {
    expect(filterPlaces(places, '')).toEqual(places)
  })

  it('matches case-insensitively', () => {
    expect(filterPlaces(places, 'PERGAMINO')).toEqual([places[0]])
  })

  it('matches accent-insensitively (query has no accent, place name does)', () => {
    expect(filterPlaces(places, 'cafe')).toEqual([places[0]])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterPlaces(places, 'zzz-no-match')).toEqual([])
  })

  it('matches a substring anywhere in the name, not just a prefix', () => {
    expect(filterPlaces(places, 'paisa')).toEqual([places[1]])
  })
})

describe('formatDistance', () => {
  it('rounds sub-1000m distances to whole meters', () => {
    expect(formatDistance(849.6)).toBe('850 m')
  })

  it('rounds a very small distance to whole meters', () => {
    expect(formatDistance(12.4)).toBe('12 m')
  })

  it('shows km with 1 decimal at or above 1000m', () => {
    expect(formatDistance(1234)).toBe('1.2 km')
  })

  it('shows exactly 1.0 km at the 1000m boundary', () => {
    expect(formatDistance(1000)).toBe('1.0 km')
  })

  it('formats a real observed backend value with ~8 decimal places', () => {
    expect(formatDistance(1151.80798524)).toBe('1.2 km')
  })
})
