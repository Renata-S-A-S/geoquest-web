import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getRedemptionStatus,
  getRewards,
  redeemReward,
  submitRedemptionRating,
  type RewardRating,
} from '@/features/rewards/rewards-api'
import { effectiveRedemptionStatus } from '@/features/rewards/redemption-status'

/**
 * Rewards — TanStack Query wiring around `rewards-api.ts`. Mirrors
 * `features/routes/queries.ts`.
 *
 * `list` has no parameters because `GET /rewards` takes none: it is
 * anonymous and unfiltered beyond the backend's Published + Active
 * business rule, so one cache entry serves every explorer.
 */
export const rewardsKeys = {
  list: ['rewards', 'list'] as const,
}

/** `GET /rewards` — the published reward catalog (its UI consumer arrives in the next work unit). */
export function useRewards() {
  return useQuery({
    queryKey: rewardsKeys.list,
    queryFn: getRewards,
  })
}

/**
 * Redemption query keys (issue #115). Only `status` exists, and it is keyed
 * by the redemption id — never by the plain `qrToken`, which has no key
 * here and must never get one: a key is a cache address, and the token's
 * whole security property is that it has no address to be read back from.
 */
export const redemptionKeys = {
  status: (userRewardId: string) => ['rewards', 'redemption', userRewardId] as const,
}

/**
 * `POST /rewards/{id}/redeem` — a MUTATION, not a query, and that choice is
 * load-bearing rather than stylistic.
 *
 * The response carries the plain `qrToken`, the only copy that will ever
 * exist (the backend keeps just `UserReward.QrTokenHash`). A query would
 * give that token a key, a cached entry, and a refetch path; a mutation
 * gives it none of the three. The result is handed to the caller and lives
 * nowhere else.
 *
 * `gcTime: 0` finishes the job: by default TanStack keeps a settled
 * mutation — including its `data`, and therefore the token — in the
 * MutationCache for five minutes after the last observer leaves. Zero drops
 * it as soon as the screen unmounts, so closing the QR really does destroy
 * it.
 *
 * `retry: false` is explicit even though it matches TanStack's default for
 * mutations. A retried redeem is NOT a retry: it reserves and spends the
 * explorer's GeoPoints again and mints a second token, orphaning the first.
 * Pinning it here keeps a future `defaultOptions.mutations` change from
 * turning a network hiccup into a double charge.
 *
 * Errors reject raw; the caller runs them through `mapRedeemRewardError`.
 */
export function useRedeemReward() {
  return useMutation({
    mutationFn: (rewardId: string) => redeemReward(rewardId),
    retry: false,
    gcTime: 0,
  })
}

/**
 * `GET /rewards/redemptions/{userRewardId}` — the ONLY way back to a
 * redemption after the redeem call, and deliberately a token-free one.
 *
 * `status` is replaced by `effectiveRedemptionStatus` rather than exposed
 * raw. The backend answers with the persisted status and never checks the
 * clock on read, so between the QR deadline and the async expiry sweep it
 * keeps reporting `Earned` for a token no scanner will accept. Deriving it
 * inside `select` means no consumer can accidentally read the stale value:
 * there is only one `status` field and it is already correct.
 *
 * @param now Injected clock, defaulting to the current instant. The default
 *   is re-evaluated on every render, so the derivation re-runs as the screen
 *   re-renders instead of freezing at fetch time; tests pass a fixed date.
 *   It is NOT a live countdown — the second at which a mounted QR flips to
 *   expired is the countdown's job in the next work unit.
 */
export function useRedemptionStatus(userRewardId: string | undefined, now: Date = new Date()) {
  return useQuery({
    queryKey: redemptionKeys.status(userRewardId ?? ''),
    queryFn: () => getRedemptionStatus(userRewardId as string),
    enabled: Boolean(userRewardId),
    select: (redemption) => ({
      ...redemption,
      status: effectiveRedemptionStatus(redemption, now),
    }),
  })
}

/**
 * `POST /rewards/redemptions/{userRewardId}/rating` (issue #116) — a
 * WRITE-ONCE mutation.
 *
 * `retry: false` is pinned for the same reason as `useRedeemReward`, though
 * the cost of getting it wrong is smaller: the backend refuses a second
 * rating with `UserReward.AlreadyRated`, so an automatic retry over a
 * dropped-but-delivered response would turn a success into a conflict the
 * explorer never caused and cannot fix.
 *
 * It invalidates NOTHING. `UserRewardStatusResult` carries no rating field,
 * so the status read has no stale value to refresh — the fact that the
 * rating landed lives in this mutation's own settled state, which is also
 * what flips its control read-only.
 */
export function useSubmitRedemptionRating(userRewardId: string) {
  return useMutation({
    mutationFn: (rating: RewardRating) => submitRedemptionRating(userRewardId, rating),
    retry: false,
  })
}
