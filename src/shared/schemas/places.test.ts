import { describe, expect, it } from 'vitest'
import {
  CATEGORY_BY_ID,
  SUBCATEGORY_BY_ID,
  categoryLabelKey,
  nearbyPlaceSchema,
  nearbyPlacesSchema,
  subcategoryLabelKey,
} from '@/shared/schemas/places'

/**
 * `GET /places/nearby` contract — verified against
 * `GeoQuest.Modules.Geo/Contracts/NearbyPlaceResult.cs` and TWO live
 * `curl GET /places/nearby` calls against the running backend (2026-08-25):
 * `category`/`subcategory` are raw numeric enum IDs on the wire (e.g.
 * `"category":4,"subcategory":17`), NOT string names — unlike
 * `GET /explorers/me`'s `interests` field, which does serialize as string
 * names (design doc decision #9). `description` is never null.
 */

const validPlace = {
  placeId: '10000000-0000-0000-0000-000000000019',
  name: 'Avenida El Poblado',
  description: 'Avenida con arte público e instalaciones urbanas.',
  category: 4,
  subcategory: 17,
  latitude: 6.211,
  longitude: -75.571,
  distanceMeters: 1707.9393969,
  pointsReward: 50,
  photos: [
    'http://localhost:9000/geoquest-checkins/places/10000000-0000-0000-0000-000000000019.jpg',
  ],
}

describe('nearbyPlaceSchema', () => {
  it('accepts the real payload shape (live-verified numeric category/subcategory)', () => {
    expect(nearbyPlaceSchema.parse(validPlace)).toEqual(validPlace)
  })

  it('rejects a payload missing description', () => {
    const { description: _description, ...rest } = validPlace
    expect(() => nearbyPlaceSchema.parse(rest)).toThrow()
  })

  it('rejects description=null (backend never sends it null)', () => {
    expect(() => nearbyPlaceSchema.parse({ ...validPlace, description: null })).toThrow()
  })

  it('rejects a category above the real enum range (0-5)', () => {
    expect(() => nearbyPlaceSchema.parse({ ...validPlace, category: 6 })).toThrow()
  })

  it('rejects a subcategory above the real enum range (0-19)', () => {
    expect(() => nearbyPlaceSchema.parse({ ...validPlace, subcategory: 20 })).toThrow()
  })

  it('rejects a negative category', () => {
    expect(() => nearbyPlaceSchema.parse({ ...validPlace, category: -1 })).toThrow()
  })

  it('rejects a string category (contract is numeric only, not the string enum names used by /explorers/me)', () => {
    expect(() => nearbyPlaceSchema.parse({ ...validPlace, category: 'Arte' })).toThrow()
  })

  it('rejects a non-integer category', () => {
    expect(() => nearbyPlaceSchema.parse({ ...validPlace, category: 4.5 })).toThrow()
  })

  it('defaults photos to an empty array when the field is missing', () => {
    const { photos: _photos, ...rest } = validPlace
    expect(nearbyPlaceSchema.parse(rest).photos).toEqual([])
  })
})

describe('nearbyPlacesSchema', () => {
  it('accepts an array of valid places', () => {
    expect(nearbyPlacesSchema.parse([validPlace])).toEqual([validPlace])
  })

  it('accepts an empty array (no nearby places found)', () => {
    expect(nearbyPlacesSchema.parse([])).toEqual([])
  })

  it('rejects an array containing one invalid place', () => {
    expect(() => nearbyPlacesSchema.parse([validPlace, { ...validPlace, category: 99 }])).toThrow()
  })
})

describe('CATEGORY_BY_ID / SUBCATEGORY_BY_ID lookup arrays', () => {
  it('has exactly 6 categories matching Category.cs order', () => {
    expect(CATEGORY_BY_ID).toEqual([
      'Gastronomia',
      'Naturaleza',
      'HistoriaCultura',
      'Aventura',
      'Arte',
      'Alojamiento',
    ])
  })

  it('has exactly 20 subcategories matching Subcategory.cs order', () => {
    expect(SUBCATEGORY_BY_ID).toHaveLength(20)
    expect(SUBCATEGORY_BY_ID[0]).toBe('Restaurant')
    expect(SUBCATEGORY_BY_ID[17]).toBe('PublicArt')
    expect(SUBCATEGORY_BY_ID[19]).toBe('Hostel')
  })
})

describe('categoryLabelKey / subcategoryLabelKey', () => {
  it('maps a live-verified category id (4) to "Arte"', () => {
    expect(categoryLabelKey(4)).toBe('Arte')
  })

  it('maps a live-verified subcategory id (17) to "PublicArt"', () => {
    expect(subcategoryLabelKey(17)).toBe('PublicArt')
  })
})
