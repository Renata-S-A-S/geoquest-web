import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import {
  getRouteById,
  getRouteProgress,
  getRoutes,
  getStartRouteErrorMessage,
  mapStartRouteError,
  startRoute,
} from '@/features/routes/routes-api'

const baseURL = 'http://localhost:5219'
const routeId = '5f2f9b3e-6e3b-4f0a-9d1a-8a3c2b4e6f01'

describe('startRoute', () => {
  it('POSTs to /routes/{id}/start with no body and parses the 201 response', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${baseURL}/routes/${routeId}/start`, async ({ request }) => {
        capturedBody = await request.text()
        return HttpResponse.json({ routeProgressId: 'progress-1' }, { status: 201 })
      })
    )

    const result = await startRoute(routeId)

    expect(result).toEqual({ routeProgressId: 'progress-1' })
    expect(capturedBody).toBe('')
  })

  it('rejects on a 404', async () => {
    server.use(
      http.post(`${baseURL}/routes/${routeId}/start`, () => new HttpResponse(null, { status: 404 }))
    )

    await expect(startRoute(routeId)).rejects.toMatchObject({ response: { status: 404 } })
  })
})

async function captureStartRouteError(): Promise<unknown> {
  try {
    await startRoute(routeId)
  } catch (error) {
    return error
  }
  throw new Error('expected startRoute to reject')
}

describe('mapStartRouteError', () => {
  it('maps a 404 to notFound', async () => {
    server.use(
      http.post(`${baseURL}/routes/${routeId}/start`, () => new HttpResponse(null, { status: 404 }))
    )
    expect(mapStartRouteError(await captureStartRouteError())).toEqual({ kind: 'notFound' })
  })

  it('maps a 409 with a RouteNotPublished title to notPublished', async () => {
    server.use(
      http.post(`${baseURL}/routes/${routeId}/start`, () =>
        HttpResponse.json({ title: 'RouteNotPublished' }, { status: 409 })
      )
    )
    expect(mapStartRouteError(await captureStartRouteError())).toEqual({ kind: 'notPublished' })
  })

  it('maps any other 409 to blocked', async () => {
    server.use(
      http.post(`${baseURL}/routes/${routeId}/start`, () =>
        HttpResponse.json({ title: 'SomeOtherBlockedRule' }, { status: 409 })
      )
    )
    expect(mapStartRouteError(await captureStartRouteError())).toEqual({ kind: 'blocked' })
  })

  it('maps a network failure to unknown', () => {
    expect(mapStartRouteError(new Error('boom'))).toEqual({ kind: 'unknown' })
  })
})

describe('getStartRouteErrorMessage', () => {
  it('resolves a translated message for each error kind', () => {
    expect(getStartRouteErrorMessage('notFound')).toBeTruthy()
    expect(getStartRouteErrorMessage('notPublished')).toBeTruthy()
    expect(getStartRouteErrorMessage('blocked')).toBeTruthy()
    expect(getStartRouteErrorMessage('unknown')).toBeTruthy()
  })
})

// 004-routes-read-endpoints (Slice B/C) — read-layer transport, RED first (task 2.1-2.3).

describe('getRoutes', () => {
  it('GET /routes maps the response to a RouteSummaryResult[]', async () => {
    const summary = {
      id: routeId,
      name: 'Centro histórico',
      routeType: 'walking',
      theme: 'historia',
      stopCount: 3,
      windowDays: 7,
      completionPointsReward: 50,
    }
    server.use(http.get(`${baseURL}/routes`, () => HttpResponse.json([summary])))

    const result = await getRoutes()

    expect(result).toEqual([summary])
  })

  it('resolves an empty array when the backend returns no published routes', async () => {
    server.use(http.get(`${baseURL}/routes`, () => HttpResponse.json([])))

    expect(await getRoutes()).toEqual([])
  })
})

describe('getRouteById', () => {
  it('GET /routes/{id} maps the response to a RouteDetailResult with myProgress null when never started', async () => {
    const detail = {
      id: routeId,
      name: 'Centro histórico',
      routeType: 'walking',
      theme: 'historia',
      windowDays: 7,
      completionPointsReward: 50,
      stops: [{ placeId: '10000000-0000-0000-0000-000000000004', name: 'Plaza Botero' }],
      myProgress: null,
    }
    server.use(http.get(`${baseURL}/routes/${routeId}`, () => HttpResponse.json(detail)))

    const result = await getRouteById(routeId)

    expect(result).toEqual(detail)
  })

  it('maps a populated (non-null) myProgress', async () => {
    const myProgress = {
      routeProgressId: 'progress-1',
      routeId,
      routeName: 'Centro histórico',
      status: 'Started',
      startedAtUtc: '2026-09-01T00:00:00Z',
      expiresAtUtc: '2026-09-08T00:00:00Z',
      completedAtUtc: null,
      completedStopCount: 1,
      totalStopCount: 3,
    }
    server.use(
      http.get(`${baseURL}/routes/${routeId}`, () =>
        HttpResponse.json({
          id: routeId,
          name: 'Centro histórico',
          routeType: 'walking',
          theme: 'historia',
          windowDays: 7,
          completionPointsReward: 50,
          stops: [],
          myProgress,
        })
      )
    )

    const result = await getRouteById(routeId)

    expect(result.myProgress).toEqual(myProgress)
  })
})

describe('getRouteProgress', () => {
  it('GET /routes/{id}/progress maps a 200 response to a RouteProgressDetailResult', async () => {
    const progress = {
      routeProgressId: 'progress-1',
      routeId,
      routeName: 'Centro histórico',
      status: 'Started',
      startedAtUtc: '2026-09-01T00:00:00Z',
      expiresAtUtc: '2026-09-08T00:00:00Z',
      completedAtUtc: null,
      completedStopCount: 1,
      totalStopCount: 3,
      stops: [
        {
          placeId: '10000000-0000-0000-0000-000000000004',
          name: 'Plaza Botero',
          isCompleted: true,
          completedAtUtc: '2026-09-01T12:00:00Z',
        },
      ],
    }
    server.use(http.get(`${baseURL}/routes/${routeId}/progress`, () => HttpResponse.json(progress)))

    const result = await getRouteProgress(routeId)

    expect(result).toEqual(progress)
  })

  it('maps a 404 to "not started" (null), never an error [scenario: Never-started route]', async () => {
    server.use(
      http.get(
        `${baseURL}/routes/${routeId}/progress`,
        () => new HttpResponse(null, { status: 404 })
      )
    )

    await expect(getRouteProgress(routeId)).resolves.toBeNull()
  })
})
