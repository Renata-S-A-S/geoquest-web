import { HttpResponse, http } from 'msw'
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import {
  createCheckin,
  getCheckinStatus,
  mapCreateCheckinError,
  uploadCheckinPhoto,
} from '@/features/checkin/checkin-api'

/**
 * `apiClient`'s dev fallback baseURL when `VITE_API_BASE_URL` is unset (see
 * `src/shared/lib/api-client.ts`) — this suite exercises the shared
 * singleton directly (mirrors `checkin-api.ts` calling `apiClient`
 * directly, same as `auth-api.ts`), so MSW must intercept that exact origin.
 */
const baseURL = 'http://localhost:5219'

const validCreateCheckinPayload = {
  placeId: '10000000-0000-0000-0000-000000000004',
  latitude: 6.2234,
  longitude: -75.5802,
  gpsAccuracyMeters: 12.5,
  photoUrl: 'https://cdn.example.com/checkins/abc.jpg',
}

async function captureCreateCheckinError() {
  try {
    await createCheckin(validCreateCheckinPayload)
    throw new Error('expected createCheckin to reject, but it resolved')
  } catch (error) {
    return error
  }
}

describe('uploadCheckinPhoto', () => {
  it('sends a multipart request with field name exactly "file" and returns photoUrl', async () => {
    let receivedFieldNames: string[] = []
    server.use(
      http.post(`${baseURL}/checkins/photo`, async ({ request }) => {
        const form = await request.formData()
        receivedFieldNames = Array.from(form.keys())
        return HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/abc.jpg' })
      })
    )

    const photoUrl = await uploadCheckinPhoto(new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' }))

    expect(receivedFieldNames).toEqual(['file'])
    expect(photoUrl).toBe('https://cdn.example.com/checkins/abc.jpg')
  })
})

describe('createCheckin', () => {
  it('sends exactly the 5 contract fields, with no gpsContextData key', async () => {
    let receivedKeys: string[] = []
    server.use(
      http.post(`${baseURL}/checkins`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        receivedKeys = Object.keys(body)
        return HttpResponse.json({ checkInId: 'checkin-123' }, { status: 202 })
      })
    )

    const checkInId = await createCheckin(validCreateCheckinPayload)

    expect(receivedKeys.sort()).toEqual(
      ['placeId', 'latitude', 'longitude', 'gpsAccuracyMeters', 'photoUrl'].sort()
    )
    expect(receivedKeys).not.toContain('gpsContextData')
    expect(checkInId).toBe('checkin-123')
  })
})

describe('getCheckinStatus', () => {
  it('parses a 200 response', async () => {
    server.use(
      http.get(`${baseURL}/checkins/checkin-123`, () =>
        HttpResponse.json({
          checkInId: 'checkin-123',
          validationStatus: 0,
          awardStatus: 0,
          xpAwarded: 0,
          geoPointsAwarded: 0,
          rejectionReason: null,
          createdAt: '2026-08-24T00:00:00Z',
        })
      )
    )

    const status = await getCheckinStatus('checkin-123')

    expect(status.checkInId).toBe('checkin-123')
    expect(status.validationStatus).toBe(0)
  })

  it('surfaces a 404 as a rejected promise, not a parsed status', async () => {
    server.use(
      http.get(`${baseURL}/checkins/missing`, () => new HttpResponse(null, { status: 404 }))
    )

    await expect(getCheckinStatus('missing')).rejects.toMatchObject({ response: { status: 404 } })
  })
})

describe('mapCreateCheckinError', () => {
  it.each([
    'OutOfRadius',
    'HardBlock24Hours',
    'PlaceInactive',
    'GpsAccuracyExceeded',
    'PlaceNotFound',
  ] as const)('maps a 400 CreateCheckInCommand.%s title to its rule', async (rule) => {
    server.use(
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: `CreateCheckInCommand.${rule}` }, { status: 400 })
      )
    )

    const error = await captureCreateCheckinError()

    expect(mapCreateCheckinError(error)).toEqual({ rule })
  })

  it('falls back to the detail message for an unrecognized 400 title', async () => {
    server.use(
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json(
          { title: 'CreateCheckInCommand.SomethingElse', detail: 'huh' },
          { status: 400 }
        )
      )
    )

    const error = await captureCreateCheckinError()

    expect(mapCreateCheckinError(error)).toEqual({ message: 'huh' })
  })

  it('returns a network-error message when there is no response', async () => {
    server.use(http.post(`${baseURL}/checkins`, () => HttpResponse.error()))

    const error = await captureCreateCheckinError()

    expect(mapCreateCheckinError(error)).toEqual({
      message: 'No pudimos conectar con el servidor. Intentá de nuevo.',
    })
  })

  it('returns the same non-axios fallback message for an unrelated error', () => {
    expect(mapCreateCheckinError(new Error('boom'))).toEqual({
      message: 'No pudimos procesar el check-in. Intentá de nuevo en unos minutos.',
    })
  })

  it('translates the static fallback messages to English after the active language changes (EN-switch)', async () => {
    await i18next.changeLanguage('en')
    server.use(http.post(`${baseURL}/checkins`, () => HttpResponse.error()))

    const error = await captureCreateCheckinError()

    expect(mapCreateCheckinError(error)).toEqual({
      message: "We couldn't connect to the server. Try again.",
    })

    await i18next.changeLanguage('es')
  })
})
