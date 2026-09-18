import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { apiClient } from '@/shared/lib/api-client'
import { getRewards, mapRedeemRewardError } from '@/features/rewards/rewards-api'

/**
 * Rewards read layer — transport tests. Mirrors `routes-api.test.ts`:
 * MSW handlers bound to whatever origin `apiClient` resolves at test time,
 * Zod parse out.
 *
 * `GET /rewards` is anonymous and returns a FLAT ARRAY (no pagination
 * envelope). The backend only filters to `Published` rewards whose business
 * is `Active`, so there is no eligibility or stock data on the wire.
 */

const baseURL = TEST_API_BASE_URL
const rewardId = '3c9a1d52-6b04-4f2d-8e77-0a1b2c3d4e5f'
const businessId = '7e1f4a08-92c3-4b6d-a5f1-1d2e3f4a5b6c'
const menuItemId = 'b4d6e8f0-1234-4567-89ab-cdef01234567'

const reward = {
  rewardId,
  businessId,
  title: 'Café gratis',
  description: 'Un café de la casa por 500 GeoPoints.',
  geoPointsCost: 500,
  estimatedValueCop: 8000,
  menuItemId,
}

describe('getRewards', () => {
  it('GET /rewards maps the response to a RewardSummaryResult[] with every contract field', async () => {
    server.use(http.get(`${baseURL}/rewards`, () => HttpResponse.json([reward])))

    const result = await getRewards()

    expect(result).toEqual([reward])
  })

  it('keeps a fractional estimatedValueCop, because the backend field is a decimal', async () => {
    server.use(
      http.get(`${baseURL}/rewards`, () =>
        HttpResponse.json([{ ...reward, estimatedValueCop: 8500.5 }])
      )
    )

    const [parsed] = await getRewards()

    expect(parsed.estimatedValueCop).toBe(8500.5)
  })

  it('parses a null menuItemId, which marks a reward not tied to a menu item', async () => {
    server.use(
      http.get(`${baseURL}/rewards`, () => HttpResponse.json([{ ...reward, menuItemId: null }]))
    )

    const [parsed] = await getRewards()

    expect(parsed.menuItemId).toBeNull()
  })

  it('resolves an empty array when no published reward has an active business', async () => {
    server.use(http.get(`${baseURL}/rewards`, () => HttpResponse.json([])))

    expect(await getRewards()).toEqual([])
  })

  it('strips fields the contract does not declare, so no UI can depend on them', async () => {
    server.use(
      http.get(`${baseURL}/rewards`, () =>
        HttpResponse.json([{ ...reward, imageUrl: 'https://cdn.example.com/reward.png' }])
      )
    )

    const [parsed] = await getRewards()

    expect(parsed).not.toHaveProperty('imageUrl')
    expect(parsed).toEqual(reward)
  })

  it('rejects a payload missing rewardId', async () => {
    const { rewardId: _omitted, ...withoutRewardId } = reward
    server.use(http.get(`${baseURL}/rewards`, () => HttpResponse.json([withoutRewardId])))

    await expect(getRewards()).rejects.toThrow()
  })
})

/**
 * `POST /rewards/{id}/redeem` error taxonomy. The endpoint itself is NOT
 * called anywhere yet (the redeem flow is a later slice), so these tests
 * drive a raw `apiClient.post` against MSW purely to produce a real Axios
 * error with the exact problem+json body the backend sends.
 *
 * The important case is the pair of 403s: `RedemptionEndpoints`
 * (`StatusCodeForRequest`) maps BOTH `IdentityNotVerified` and
 * `BusinessNotActive` to 403, so a mapper that discriminated on the status
 * code alone would report "verify your identity" for an inactive business.
 */
async function captureRedeemError(status: number, body?: unknown): Promise<unknown> {
  server.use(
    http.post(`${baseURL}/rewards/${rewardId}/redeem`, () =>
      body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status })
    )
  )

  try {
    await apiClient.post(`/rewards/${rewardId}/redeem`)
  } catch (error) {
    return error
  }
  throw new Error('expected the redeem request to reject')
}

describe('mapRedeemRewardError', () => {
  it('maps a 403 titled IdentityNotVerified to identityNotVerified', async () => {
    const error = await captureRedeemError(403, {
      title: 'RequestRewardRedemptionCommand.IdentityNotVerified',
      detail: 'Tu identidad todavía no está verificada.',
      status: 403,
    })

    expect(mapRedeemRewardError(error)).toEqual({ kind: 'identityNotVerified' })
  })

  it('maps a 403 titled BusinessNotActive to businessNotActive, NOT to identityNotVerified', async () => {
    const error = await captureRedeemError(403, {
      title: 'RequestRewardRedemptionCommand.BusinessNotActive',
      detail: 'El comercio no está activo.',
      status: 403,
    })

    expect(mapRedeemRewardError(error)).toEqual({ kind: 'businessNotActive' })
  })

  it('maps a 404 titled RewardNotFound to rewardNotFound', async () => {
    const error = await captureRedeemError(404, {
      title: 'RequestRewardRedemptionCommand.RewardNotFound',
      status: 404,
    })

    expect(mapRedeemRewardError(error)).toEqual({ kind: 'rewardNotFound' })
  })

  it('maps a 409 titled Reward.StockExhausted to stockExhausted', async () => {
    const error = await captureRedeemError(409, { title: 'Reward.StockExhausted', status: 409 })

    expect(mapRedeemRewardError(error)).toEqual({ kind: 'stockExhausted' })
  })

  it('maps a 400 with an untracked title to unknown', async () => {
    const error = await captureRedeemError(400, {
      title: 'RequestRewardRedemptionCommand.SomeFutureRule',
      status: 400,
    })

    expect(mapRedeemRewardError(error)).toEqual({ kind: 'unknown' })
  })

  it('maps a 403 with no problem+json body to unknown, because the two 403 causes are indistinguishable without a title', async () => {
    const error = await captureRedeemError(403)

    expect(mapRedeemRewardError(error)).toEqual({ kind: 'unknown' })
  })

  it('maps an empty problem+json title to unknown, not to an empty kind', async () => {
    const error = await captureRedeemError(400, { title: '', status: 400 })

    expect(mapRedeemRewardError(error)).toEqual({ kind: 'unknown' })
  })

  it('maps a non-Axios failure to unknown', () => {
    expect(mapRedeemRewardError(new Error('boom'))).toEqual({ kind: 'unknown' })
  })
})
