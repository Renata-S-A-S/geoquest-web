import axios from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import { problemDetailsSchema } from '@/shared/schemas/auth'
import {
  rewardRedemptionResultSchema,
  rewardSummaryResultSchema,
  userRewardStatusResultSchema,
  type RewardRedemptionResult,
  type RewardSummaryResult,
  type UserRewardStatusResult,
} from '@/features/rewards/schemas'

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

/**
 * `POST /rewards/{id}/redeem`.
 *
 * THE PLAIN `qrToken` IN THIS RESPONSE IS THE ONLY COPY THAT WILL EVER
 * EXIST. The backend persists `UserReward.QrTokenHash` and never the token
 * itself — the same criterion `RefreshToken` uses — so there is no endpoint
 * that can return it again. `getRedemptionStatus` below is NOT a second
 * source: its contract has no token field at all.
 *
 * That shapes this API on purpose:
 *
 * - the result is returned to the caller and NOTHING here writes it into
 *   the React Query cache, a store, or `localStorage`;
 * - `queries.ts` exposes it through a MUTATION, which has no query key, so
 *   the token can never end up in a cache key, a devtools payload, or a
 *   refetch;
 * - re-calling this function is NOT a way to recover a lost token: it is a
 *   new redemption that spends the explorer's GeoPoints again and mints a
 *   different token, orphaning the first.
 *
 * A losable token is the designed behavior, not a gap to work around.
 *
 * Rejections are left raw so the caller can run them through
 * `mapRedeemRewardError` above — the mapper needs the Axios error, not a
 * pre-digested one.
 */
export async function redeemReward(rewardId: string): Promise<RewardRedemptionResult> {
  const { data } = await apiClient.post(`/rewards/${rewardId}/redeem`)
  return rewardRedemptionResultSchema.parse(data)
}

/**
 * `GET /rewards/redemptions/{userRewardId}`.
 *
 * NO ERROR MAPPER, deliberately. The endpoint reports exactly two failures,
 * `GetUserRewardStatusQuery.NotFound` (404) and
 * `GetUserRewardStatusQuery.NotAuthorized` (403), and neither is a business
 * rule an explorer can act on:
 *
 * - the only `userRewardId` this app ever polls is the one THIS client just
 *   received from its own `redeemReward` call, so both failures mean the id
 *   is wrong, tampered with, or gone — a defect, not a decision;
 * - unlike the redeem 403 pair, the two codes are already distinguishable
 *   by status, so a mapper would add no information the caller lacks;
 * - a taxonomy no screen can branch on differently is dead weight. The
 *   precedent here is `getRewards` / `getCheckinStatus` / `getRouteProgress`:
 *   reads reject and the caller renders its own error state, and a mapper
 *   is added only where the copy must actually change.
 *
 * If a later slice deep-links a redemption an explorer may not own, "not
 * yours" and "does not exist" become genuinely different messages and the
 * mapper earns its place then, with a real consumer.
 *
 * It also REJECTS a 404 rather than resolving `null` — the opposite of
 * `getRouteProgress`, where "never started" is a normal state. A redemption
 * id only exists because a redemption succeeded, so a missing one is an
 * anomaly and must not be flattened into "nothing to show".
 */
export async function getRedemptionStatus(userRewardId: string): Promise<UserRewardStatusResult> {
  const { data } = await apiClient.get(`/rewards/redemptions/${userRewardId}`)
  return userRewardStatusResultSchema.parse(data)
}
