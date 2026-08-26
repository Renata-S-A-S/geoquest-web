import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import {
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
