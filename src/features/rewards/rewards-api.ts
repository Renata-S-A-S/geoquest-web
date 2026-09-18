import axios from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import { problemDetailsSchema } from '@/shared/schemas/auth'
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

/**
 * Every failure `POST /rewards/{id}/redeem` can report, as a local
 * taxonomy. Same convention as `mapCreateCheckinError`
 * (`features/checkin/checkin-api.ts`) and `mapStartRouteError`
 * (`features/routes/routes-api.ts`): a plain function over problem+json,
 * NOT a shared interceptor. `installAuthInterceptors` deliberately owns
 * only the 401 refresh-and-retry — a transport concern — and rethrows a
 * 403 untouched, so business rules stay with the feature that reads them.
 */
export type RedeemRewardErrorKind =
  'identityNotVerified' | 'businessNotActive' | 'rewardNotFound' | 'stockExhausted' | 'unknown'

export type RedeemRewardError = { kind: RedeemRewardErrorKind }

/**
 * Backend error code (problem+json `title`) -> local kind. `ProblemResults`
 * sets `title` to the raw `Error.Code` and `detail` to the localized
 * message, so `title` is the only stable discriminator on the wire.
 *
 * The keys are matched WHOLE, not by prefix: `Reward.StockExhausted` does
 * not share the `RequestRewardRedemptionCommand.` prefix the other three
 * carry, so the prefix-stripping shape used by `mapCreateCheckinError`
 * would not cover it.
 */
const REDEEM_ERROR_KIND_BY_TITLE: Record<string, RedeemRewardErrorKind> = {
  'RequestRewardRedemptionCommand.IdentityNotVerified': 'identityNotVerified',
  'RequestRewardRedemptionCommand.BusinessNotActive': 'businessNotActive',
  'RequestRewardRedemptionCommand.RewardNotFound': 'rewardNotFound',
  'Reward.StockExhausted': 'stockExhausted',
}

/**
 * Maps a `POST /rewards/{id}/redeem` rejection to a `RedeemRewardError`.
 *
 * It discriminates on the problem+json `title`, NEVER on the HTTP status,
 * because `RedemptionEndpoints.StatusCodeForRequest` answers 403 for TWO
 * unrelated causes: `IdentityNotVerified` and `BusinessNotActive`. Reading
 * the status alone would tell an explorer to verify their identity when the
 * real problem is that the business is inactive — an instruction they could
 * never act on.
 *
 * That is also why a 403 with no parseable title falls back to `unknown`
 * rather than to `identityNotVerified`: without the title the two causes
 * are genuinely indistinguishable, and guessing would resurface the same
 * wrong instruction.
 */
export function mapRedeemRewardError(error: unknown): RedeemRewardError {
  if (!axios.isAxiosError(error) || !error.response) return { kind: 'unknown' }

  const problem = problemDetailsSchema.safeParse(error.response.data)
  const title = problem.success ? problem.data.title : undefined

  // Indexed only when a title is actually present: `title` is optional AND
  // may legitimately arrive empty, and `'' && ...` would short-circuit to
  // `''` — an empty kind that is in no union and matches no branch.
  const kind = title === undefined ? undefined : REDEEM_ERROR_KIND_BY_TITLE[title]

  return { kind: kind ?? 'unknown' }
}
