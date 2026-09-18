import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { redemptionKeys, useRedeemReward, useRedemptionStatus } from '@/features/rewards/queries'

/**
 * Redemption hooks (issue #115, PR 11a). Two properties are load-bearing
 * here and neither is visible in the transport tests:
 *
 * 1. the plain `qrToken` must have NO cached home — no query key, and no
 *    mutation entry outliving the screen that asked for it;
 * 2. the status read must expose the DERIVED status, because the backend
 *    reports a persisted one that goes stale at the QR deadline.
 */
const baseURL = TEST_API_BASE_URL
const rewardId = '3c9a1d52-6b04-4f2d-8e77-0a1b2c3d4e5f'
const userRewardId = 'd41f9a76-5c3e-4b2a-9f18-2e7c6b5a4d3c'
const qrToken = 'PLAIN-QR-TOKEN-ONLY-EVER-SENT-ONCE'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function stubRedeem() {
  server.use(
    http.post(`${baseURL}/rewards/${rewardId}/redeem`, () =>
      HttpResponse.json({ userRewardId, qrToken, qrExpiresAtUtc: '2026-09-17T18:30:00Z' })
    )
  )
}

function stubStatus(body: Record<string, unknown>) {
  server.use(
    http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () => HttpResponse.json(body))
  )
}

const earnedAt1830 = {
  userRewardId,
  rewardId,
  status: 'Earned',
  qrExpiresAtUtc: '2026-09-17T18:30:00Z',
  earnedAtUtc: '2026-09-17T18:00:00Z',
  redeemedAtUtc: null,
}

describe('useRedeemReward', () => {
  it('resolves the redemption, the one and only delivery of the plain token', async () => {
    stubRedeem()
    const queryClient = newQueryClient()
    const { result } = renderHook(() => useRedeemReward(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync(rewardId)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.qrToken).toBe(qrToken)
  })

  it('writes nothing into the query cache, so the token has no key to be read back from', async () => {
    stubRedeem()
    const queryClient = newQueryClient()
    const { result } = renderHook(() => useRedeemReward(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync(rewardId)
    })

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('drops the mutation entry once the screen unmounts, leaving no token in memory', async () => {
    stubRedeem()
    const queryClient = newQueryClient()
    const { result, unmount } = renderHook(() => useRedeemReward(), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync(rewardId)
    })
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1)

    unmount()

    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0))
  })

  it('issues exactly one request per redeem, because a retry would spend GeoPoints twice', async () => {
    let calls = 0
    server.use(
      http.post(`${baseURL}/rewards/${rewardId}/redeem`, () => {
        calls += 1
        return HttpResponse.json({ title: 'Reward.StockExhausted', status: 409 }, { status: 409 })
      })
    )
    const queryClient = newQueryClient()
    const { result } = renderHook(() => useRedeemReward(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync(rewardId).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(calls).toBe(1)
  })
})

describe('useRedemptionStatus', () => {
  it('reports Expired for a backend Earned whose QR deadline already passed', async () => {
    stubStatus(earnedAt1830)
    const queryClient = newQueryClient()
    const { result } = renderHook(
      () => useRedemptionStatus(userRewardId, new Date('2026-09-17T18:30:01Z')),
      {
        wrapper: wrapper(queryClient),
      }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('Expired')
  })

  it('keeps Earned while the QR deadline is still ahead', async () => {
    stubStatus(earnedAt1830)
    const queryClient = newQueryClient()
    const { result } = renderHook(
      () => useRedemptionStatus(userRewardId, new Date('2026-09-17T18:29:00Z')),
      {
        wrapper: wrapper(queryClient),
      }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('Earned')
  })

  it('stays idle without a userRewardId instead of requesting an undefined redemption', () => {
    const queryClient = newQueryClient()
    const { result } = renderHook(() => useRedemptionStatus(undefined), {
      wrapper: wrapper(queryClient),
    })

    // MSW runs with `onUnhandledRequest: 'error'` and no handler is
    // registered here, so any request at all would fail this test. A
    // disabled query still registers a cache entry, hence the assertion is
    // on `fetchStatus`/`data`, not on the cache being empty.
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('keys the status query by the redemption id alone, never by the token', () => {
    expect(redemptionKeys.status(userRewardId)).toEqual(['rewards', 'redemption', userRewardId])
  })
})
