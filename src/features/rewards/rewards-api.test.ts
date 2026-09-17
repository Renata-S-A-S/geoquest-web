import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { getRewards } from '@/features/rewards/rewards-api'

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
