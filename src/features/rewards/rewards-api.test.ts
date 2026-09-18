import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { apiClient } from '@/shared/lib/api-client'
import {
  getRedemptionStatus,
  getRewards,
  mapRedeemRewardError,
  mapSubmitRatingError,
  redeemReward,
  submitRedemptionRating,
} from '@/features/rewards/rewards-api'

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

/**
 * Redemption transport (issue #115, PR 11a). Same MSW-at-the-wire shape as
 * the read tests above: the transport is never mocked, only the origin it
 * talks to.
 *
 * `qrToken` is the plain token and exists on the wire EXACTLY ONCE, in the
 * `POST .../redeem` response — the backend persists only its hash
 * (`UserReward.QrTokenHash`, the same criterion as `RefreshToken`). These
 * tests therefore pin two things the type signature alone cannot: the
 * redeem response really carries it, and the status response can never
 * carry it back.
 */
const userRewardId = 'd41f9a76-5c3e-4b2a-9f18-2e7c6b5a4d3c'

const redemption = {
  userRewardId,
  qrToken: 'PLAIN-QR-TOKEN-ONLY-EVER-SENT-ONCE',
  qrExpiresAtUtc: '2026-09-17T18:30:00Z',
}

const redemptionStatus = {
  userRewardId,
  rewardId,
  status: 'Earned',
  qrExpiresAtUtc: '2026-09-17T18:30:00Z',
  earnedAtUtc: '2026-09-17T18:00:00Z',
  redeemedAtUtc: null,
}

describe('redeemReward', () => {
  it('maps POST /rewards/{id}/redeem to a RewardRedemptionResult with every contract field', async () => {
    server.use(
      http.post(`${baseURL}/rewards/${rewardId}/redeem`, () => HttpResponse.json(redemption))
    )

    expect(await redeemReward(rewardId)).toEqual(redemption)
  })

  it('strips fields the contract does not declare, so nothing can ride alongside the token', async () => {
    server.use(
      http.post(`${baseURL}/rewards/${rewardId}/redeem`, () =>
        HttpResponse.json({ ...redemption, qrImageUrl: 'https://cdn.example.com/qr.png' })
      )
    )

    const result = await redeemReward(rewardId)

    expect(result).not.toHaveProperty('qrImageUrl')
    expect(result).toEqual(redemption)
  })

  it('rejects a response missing qrToken, because the token can never be re-fetched', async () => {
    const { qrToken: _omitted, ...withoutToken } = redemption
    server.use(
      http.post(`${baseURL}/rewards/${rewardId}/redeem`, () => HttpResponse.json(withoutToken))
    )

    await expect(redeemReward(rewardId)).rejects.toThrow()
  })

  it('rejects the documented failures so the caller can run them through mapRedeemRewardError', async () => {
    server.use(
      http.post(`${baseURL}/rewards/${rewardId}/redeem`, () =>
        HttpResponse.json({ title: 'Reward.StockExhausted', status: 409 }, { status: 409 })
      )
    )

    await expect(redeemReward(rewardId)).rejects.toMatchObject({ response: { status: 409 } })
  })
})

describe('getRedemptionStatus', () => {
  it('maps GET /rewards/redemptions/{id} to a UserRewardStatusResult with every contract field', async () => {
    server.use(
      http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () =>
        HttpResponse.json(redemptionStatus)
      )
    )

    expect(await getRedemptionStatus(userRewardId)).toEqual(redemptionStatus)
  })

  it('parses the null timestamps a PendingReservation carries', async () => {
    server.use(
      http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () =>
        HttpResponse.json({
          ...redemptionStatus,
          status: 'PendingReservation',
          qrExpiresAtUtc: null,
          earnedAtUtc: null,
          redeemedAtUtc: null,
        })
      )
    )

    const result = await getRedemptionStatus(userRewardId)

    expect(result.qrExpiresAtUtc).toBeNull()
    expect(result.earnedAtUtc).toBeNull()
    expect(result.redeemedAtUtc).toBeNull()
  })

  it.each(['PendingReservation', 'Earned', 'Redeemed', 'Expired', 'Failed'])(
    'accepts the documented status %s',
    async (status) => {
      server.use(
        http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () =>
          HttpResponse.json({ ...redemptionStatus, status })
        )
      )

      expect((await getRedemptionStatus(userRewardId)).status).toBe(status)
    }
  )

  it('rejects a status outside the documented set instead of passing it through', async () => {
    server.use(
      http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () =>
        HttpResponse.json({ ...redemptionStatus, status: 'Reserved' })
      )
    )

    await expect(getRedemptionStatus(userRewardId)).rejects.toThrow()
  })

  it('drops a qrToken even if the status payload ever carried one, so the token has no second source', async () => {
    server.use(
      http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () =>
        HttpResponse.json({ ...redemptionStatus, qrToken: 'PLAIN-QR-TOKEN-ONLY-EVER-SENT-ONCE' })
      )
    )

    expect(await getRedemptionStatus(userRewardId)).not.toHaveProperty('qrToken')
  })

  it('rejects a 404 NotFound instead of resolving null, unlike getRouteProgress', async () => {
    server.use(
      http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () =>
        HttpResponse.json(
          { title: 'GetUserRewardStatusQuery.NotFound', status: 404 },
          { status: 404 }
        )
      )
    )

    await expect(getRedemptionStatus(userRewardId)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  it('rejects a 403 NotAuthorized, which no explorer-facing copy can act on', async () => {
    server.use(
      http.get(`${baseURL}/rewards/redemptions/${userRewardId}`, () =>
        HttpResponse.json(
          { title: 'GetUserRewardStatusQuery.NotAuthorized', status: 403 },
          { status: 403 }
        )
      )
    )

    await expect(getRedemptionStatus(userRewardId)).rejects.toMatchObject({
      response: { status: 403 },
    })
  })
})

/**
 * Rating transport (issue #116). Same MSW-at-the-wire shape as everything
 * above.
 *
 * The case that matters is the 409 PAIR. `StatusCodeForRating` answers 409
 * for BOTH `UserReward.AlreadyRated` and `UserReward.NotRedeemed`, exactly
 * like the 403 pair the redeem mapper already handles, and the two are not
 * the same situation for an explorer: one is finished, the other is a "come
 * back after you use it". A mapper that read the status code would collapse
 * them into one message and throw away the only bit that says whether to
 * return.
 */
async function captureRatingError(status: number, body?: unknown): Promise<unknown> {
  server.use(
    http.post(`${baseURL}/rewards/redemptions/${userRewardId}/rating`, () =>
      body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status })
    )
  )

  try {
    await apiClient.post(`/rewards/redemptions/${userRewardId}/rating`)
  } catch (error) {
    return error
  }
  throw new Error('expected the rating request to reject')
}

describe('submitRedemptionRating', () => {
  it('POSTs the rating as an integer body and resolves on a 204 with no content', async () => {
    let sentBody: unknown
    server.use(
      http.post(`${baseURL}/rewards/redemptions/${userRewardId}/rating`, async ({ request }) => {
        sentBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      })
    )

    await expect(submitRedemptionRating(userRewardId, 4)).resolves.toBeUndefined()
    expect(sentBody).toEqual({ rating: 4 })
  })

  it('rejects the documented failures so the caller can run them through mapSubmitRatingError', async () => {
    server.use(
      http.post(`${baseURL}/rewards/redemptions/${userRewardId}/rating`, () =>
        HttpResponse.json({ title: 'UserReward.AlreadyRated', status: 409 }, { status: 409 })
      )
    )

    await expect(submitRedemptionRating(userRewardId, 5)).rejects.toMatchObject({
      response: { status: 409 },
    })
  })
})

describe('mapSubmitRatingError', () => {
  it('maps a 409 titled UserReward.AlreadyRated to alreadyRated', async () => {
    const error = await captureRatingError(409, { title: 'UserReward.AlreadyRated', status: 409 })

    expect(mapSubmitRatingError(error)).toEqual({ kind: 'alreadyRated' })
  })

  it('maps a 409 titled UserReward.NotRedeemed to notRedeemed, NOT to alreadyRated', async () => {
    const error = await captureRatingError(409, { title: 'UserReward.NotRedeemed', status: 409 })

    expect(mapSubmitRatingError(error)).toEqual({ kind: 'notRedeemed' })
  })

  it('maps a 404 NotFound to redemptionNotFound', async () => {
    const error = await captureRatingError(404, {
      title: 'SubmitRewardExperienceRatingCommand.NotFound',
      status: 404,
    })

    expect(mapSubmitRatingError(error)).toEqual({ kind: 'redemptionNotFound' })
  })

  it('maps a 403 NotAuthorized to notAuthorized', async () => {
    const error = await captureRatingError(403, {
      title: 'SubmitRewardExperienceRatingCommand.NotAuthorized',
      status: 403,
    })

    expect(mapSubmitRatingError(error)).toEqual({ kind: 'notAuthorized' })
  })

  it('maps a 409 with no parseable title to unknown, because the two causes are then indistinguishable', async () => {
    expect(mapSubmitRatingError(await captureRatingError(409))).toEqual({ kind: 'unknown' })
  })

  it('maps a non-Axios failure to unknown', () => {
    expect(mapSubmitRatingError(new Error('boom'))).toEqual({ kind: 'unknown' })
  })
})
