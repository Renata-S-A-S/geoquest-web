import axios from 'axios'
import { HttpResponse, delay, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { __resetRefreshState, installAuthInterceptors } from '@/shared/lib/auth-interceptor'
import { useAuthStore } from '@/shared/stores/auth-store'

const baseURL = 'http://test.local'

function createClient() {
  const client = axios.create({ baseURL })
  installAuthInterceptors(client)
  return client
}

function login(accessToken: string, refreshToken = 'refresh-token') {
  useAuthStore.getState().login({
    accessToken,
    accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
    refreshToken,
    refreshTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
  })
}

beforeEach(() => {
  useAuthStore.getState().logout()
  __resetRefreshState()
})

describe('installAuthInterceptors — request interceptor', () => {
  it('attaches Authorization: Bearer <accessToken> when a token is present', async () => {
    login('fresh-token')
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) =>
        HttpResponse.json({ authHeader: request.headers.get('authorization') })
      )
    )

    const client = createClient()
    const { data } = await client.get('/resource')

    expect(data.authHeader).toBe('Bearer fresh-token')
  })

  it('omits the Authorization header when no access token is present', async () => {
    server.use(
      http.get(`${baseURL}/resource`, ({ request }) =>
        HttpResponse.json({ authHeader: request.headers.get('authorization') })
      )
    )

    const client = createClient()
    const { data } = await client.get('/resource')

    expect(data.authHeader).toBeNull()
  })

  it.each(['/auth/login', '/auth/refresh'])(
    'never attaches Authorization to %s even when a token is present',
    async (path) => {
      login('fresh-token')
      server.use(
        http.post(`${baseURL}${path}`, ({ request }) =>
          HttpResponse.json({ authHeader: request.headers.get('authorization') })
        )
      )

      const client = createClient()
      const { data } = await client.post(path, {})

      expect(data.authHeader).toBeNull()
    }
  )
})

describe('installAuthInterceptors — 401 refresh-and-retry', () => {
  it('refreshes once and retries the original GET request on 401', async () => {
    login('expired', 'refresh-token')
    let refreshCallCount = 0

    server.use(
      http.get(`${baseURL}/resource`, ({ request }) => {
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer fresh-token') {
          return HttpResponse.json({ ok: true })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${baseURL}/auth/refresh`, async ({ request }) => {
        refreshCallCount += 1
        const body = (await request.json()) as { refreshToken: string }
        expect(body.refreshToken).toBe('refresh-token')
        return HttpResponse.json({
          accessToken: 'fresh-token',
          accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
          refreshToken: 'new-refresh-token',
          refreshTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
        })
      })
    )

    const client = createClient()
    const { data } = await client.get('/resource')

    expect(data).toEqual({ ok: true })
    expect(refreshCallCount).toBe(1)
    expect(useAuthStore.getState().accessToken).toBe('fresh-token')
  })

  it.each(['get', 'post', 'put', 'delete'] as const)(
    'retries a %s request after refresh, regardless of HTTP method',
    async (method) => {
      login('expired', 'refresh-token')

      server.use(
        http[method](`${baseURL}/resource`, ({ request }) => {
          const auth = request.headers.get('authorization')
          if (auth === 'Bearer fresh-token') {
            return HttpResponse.json({ ok: true, method })
          }
          return new HttpResponse(null, { status: 401 })
        }),
        http.post(`${baseURL}/auth/refresh`, () =>
          HttpResponse.json({
            accessToken: 'fresh-token',
            accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
            refreshToken: 'new-refresh-token',
            refreshTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
          })
        )
      )

      const client = createClient()
      const { data } = await client.request({ method, url: '/resource' })

      expect(data).toEqual({ ok: true, method })
    }
  )

  it('leaves the original request pending on the real refresh latency, with no artificial UI state in between', async () => {
    login('expired', 'refresh-token')
    let resolved = false

    server.use(
      http.get(`${baseURL}/resource`, ({ request }) => {
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer fresh-token') {
          return HttpResponse.json({ ok: true })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${baseURL}/auth/refresh`, async () => {
        await delay(50)
        return HttpResponse.json({
          accessToken: 'fresh-token',
          accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
          refreshToken: 'new-refresh-token',
          refreshTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
        })
      })
    )

    const client = createClient()
    const requestPromise = client.get('/resource').then((response) => {
      resolved = true
      return response
    })

    // The interceptor module exposes no loading flag, store field, or
    // callback of its own — the ONLY observable state while the refresh is
    // in flight is that this promise has not settled yet. If any
    // refresh-specific UI/side-effect state existed, this window is where a
    // premature resolution or an intermediate value would leak through.
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(resolved).toBe(false)

    const { data } = await requestPromise

    // The only thing that ever unblocks the caller is the real, delayed
    // HTTP response — not a synthetic/optimistic resolution.
    expect(resolved).toBe(true)
    expect(data).toEqual({ ok: true })
  })

  it('issues exactly one refresh call when 5 requests 401 concurrently', async () => {
    login('expired', 'refresh-token')
    let refreshCallCount = 0

    server.use(
      http.get(`${baseURL}/resource`, ({ request }) => {
        const auth = request.headers.get('authorization')
        if (auth === 'Bearer fresh-token') {
          return HttpResponse.json({ ok: true })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${baseURL}/auth/refresh`, () => {
        refreshCallCount += 1
        return HttpResponse.json({
          accessToken: 'fresh-token',
          accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
          refreshToken: 'new-refresh-token',
          refreshTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
        })
      })
    )

    const client = createClient()
    const results = await Promise.all(Array.from({ length: 5 }, () => client.get('/resource')))

    expect(refreshCallCount).toBe(1)
    expect(results).toHaveLength(5)
    for (const result of results) {
      expect(result.data).toEqual({ ok: true })
    }
  })
})

describe('installAuthInterceptors — refresh failure and anti-loop guard', () => {
  it('logs out and rejects with the original 401 when the refresh call fails', async () => {
    login('expired', 'invalid-refresh-token')

    server.use(
      http.get(`${baseURL}/resource`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${baseURL}/auth/refresh`, () =>
        HttpResponse.json({ title: 'Identity.InvalidRefreshToken' }, { status: 401 })
      )
    )

    const client = createClient()

    await expect(client.get('/resource')).rejects.toMatchObject({
      response: { status: 401, config: { url: '/resource' } },
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('rejects each pending request with its own original 401, not a cancellation, when concurrent refresh fails', async () => {
    login('expired', 'invalid-refresh-token')

    server.use(
      http.get(`${baseURL}/resource-a`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${baseURL}/resource-b`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${baseURL}/auth/refresh`, () =>
        HttpResponse.json({ title: 'Identity.InvalidRefreshToken' }, { status: 401 })
      )
    )

    const client = createClient()

    const [resultA, resultB] = await Promise.allSettled([
      client.get('/resource-a'),
      client.get('/resource-b'),
    ])

    expect(resultA.status).toBe('rejected')
    expect(resultB.status).toBe('rejected')

    const errorA = (resultA as PromiseRejectedResult).reason
    const errorB = (resultB as PromiseRejectedResult).reason

    // No AbortController exists anywhere in the interceptor, so neither
    // pending request may reject as "canceled"/"aborted" — each must
    // resolve its own lifecycle independently, ending in its own original
    // 401 response.
    expect(axios.isCancel(errorA)).toBe(false)
    expect(axios.isCancel(errorB)).toBe(false)
    expect(errorA.code).not.toBe('ERR_CANCELED')
    expect(errorB.code).not.toBe('ERR_CANCELED')
    expect(errorA.response).toMatchObject({ status: 401, config: { url: '/resource-a' } })
    expect(errorB.response).toMatchObject({ status: 401, config: { url: '/resource-b' } })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('does not attempt a second refresh when the retried request 401s again', async () => {
    login('expired', 'refresh-token')
    let refreshCallCount = 0

    server.use(
      http.get(`${baseURL}/always-401`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${baseURL}/auth/refresh`, () => {
        refreshCallCount += 1
        return HttpResponse.json({
          accessToken: 'fresh-token',
          accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
          refreshToken: 'new-refresh-token',
          refreshTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
        })
      })
    )

    const client = createClient()

    await expect(client.get('/always-401')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(refreshCallCount).toBe(1)
  })
})
