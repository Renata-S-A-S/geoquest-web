import { apiClient } from '@/shared/lib/api-client'
import { rewardSummaryResultSchema, type RewardSummaryResult } from '@/features/rewards/schemas'

/**
 * Rewards read-layer transport. Mirrors `getRoutes` in
 * `features/routes/routes-api.ts`: calls go through the shared `apiClient`
 * singleton and the response is parsed out through Zod.
 *
 * `GET /rewards` is anonymous and has no documented failure path, so there
 * is no error mapper here. A network or parse failure simply rejects and
 * the caller renders its own error state — the same "caller decides"
 * precedent as `getRoutes` and `getCheckinStatus`.
 */
export async function getRewards(): Promise<RewardSummaryResult[]> {
  const { data } = await apiClient.get('/rewards')
  return rewardSummaryResultSchema.array().parse(data)
}
