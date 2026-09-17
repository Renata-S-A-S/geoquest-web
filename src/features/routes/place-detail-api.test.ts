import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { getPlaceById } from '@/features/routes/place-detail-api'

/** The origin `apiClient` resolves at test time — see `places-api.test.ts`. */
const baseURL = TEST_API_BASE_URL

const placePayload = {
  placeId: '10000000-0000-0000-0000-000000000001',
  name: 'Plaza Botero',
  description: 'Plaza pública con 23 esculturas de Fernando Botero.',
  category: 4,
  subcategory: 17,
  latitude: 6.2518,
  longitude: -75.5636,
  xpReward: 50,
  geoPointsReward: 0,
  photos: [
    'http://localhost:9000/geoquest-checkins/places/10000000-0000-0000-0000-000000000001.jpg',
  ],
}

describe('getPlaceById', () => {
  it('parses a 200 GET /places/{id} response', async () => {
    let capturedUrl: string | undefined
    server.use(
      http.get(`${baseURL}/places/:id`, ({ request, params }) => {
        capturedUrl = request.url
        expect(params.id).toBe(placePayload.placeId)
        return HttpResponse.json(placePayload)
      })
    )

    const place = await getPlaceById(placePayload.placeId)

    expect(place).toEqual(placePayload)
    expect(capturedUrl).toContain(`/places/${placePayload.placeId}`)
  })

  it('parses a payload with no photos as an empty array', async () => {
    const { photos: _photos, ...rest } = placePayload
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(rest)))

    await expect(getPlaceById(placePayload.placeId)).resolves.toMatchObject({ photos: [] })
  })

  it('surfaces a 404 as a rejected promise, not a parsed place', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => new HttpResponse(null, { status: 404 })))

    await expect(getPlaceById('does-not-exist')).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  it('surfaces a 500 as a rejected promise', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => new HttpResponse(null, { status: 500 })))

    await expect(getPlaceById(placePayload.placeId)).rejects.toMatchObject({
      response: { status: 500 },
    })
  })
})
