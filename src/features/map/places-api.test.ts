import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { getNearbyPlaces } from '@/features/map/places-api'

/**
 * `apiClient`'s dev fallback baseURL (see `gamification-api.test.ts` for the
 * same note) — MSW must intercept that exact origin. Fixture returns
 * real-shaped ints for category/subcategory, not strings (live-verified,
 * see `shared/schemas/places.ts`).
 */
const baseURL = 'http://localhost:5219'

const nearbyPayload = [
  {
    placeId: '10000000-0000-0000-0000-000000000019',
    name: 'Avenida El Poblado',
    description: 'Avenida con arte público e instalaciones urbanas.',
    category: 4,
    subcategory: 17,
    latitude: 6.211,
    longitude: -75.571,
    distanceMeters: 1707.9393969,
    pointsReward: 50,
    photos: ['http://localhost:9000/geoquest-checkins/places/10000000-0000-0000-0000-000000000019.jpg'],
  },
]

describe('getNearbyPlaces', () => {
  it('parses a 200 GET /places/nearby response with lat/lng query params', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get(`${baseURL}/places/nearby`, ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json(nearbyPayload)
      })
    )

    const places = await getNearbyPlaces({ lat: 6.211, lng: -75.571 })

    expect(places).toEqual(nearbyPayload)
    expect(capturedUrl?.searchParams.get('lat')).toBe('6.211')
    expect(capturedUrl?.searchParams.get('lng')).toBe('-75.571')
  })

  it('sends radiusM and category as query params when provided', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get(`${baseURL}/places/nearby`, ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json(nearbyPayload)
      })
    )

    await getNearbyPlaces({ lat: 6.211, lng: -75.571, radiusM: 5000, category: 4 })

    expect(capturedUrl?.searchParams.get('radiusM')).toBe('5000')
    expect(capturedUrl?.searchParams.get('category')).toBe('4')
  })

  it('parses an empty result array', async () => {
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([])))

    await expect(getNearbyPlaces({ lat: 6.211, lng: -75.571 })).resolves.toEqual([])
  })

  it('surfaces a 500 as a rejected promise, not a parsed list', async () => {
    server.use(http.get(`${baseURL}/places/nearby`, () => new HttpResponse(null, { status: 500 })))

    await expect(getNearbyPlaces({ lat: 6.211, lng: -75.571 })).rejects.toMatchObject({
      response: { status: 500 },
    })
  })
})
