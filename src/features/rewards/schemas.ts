import { z } from 'zod'

/**
 * Rewards contracts — Zod parse out, same convention as
 * `features/routes/schemas.ts`. Field names and nullability confirmed
 * against the backend source
 * `GeoQuest.Modules.Rewards.Contracts.RewardSummaryResult` (ASP.NET's
 * default camelCase policy only lowercases the first character of each
 * property name).
 */

/**
 * `GET /rewards` list item (`RewardSummaryResult`). The endpoint is
 * anonymous and returns a FLAT ARRAY — no pagination envelope.
 *
 * The backend filters ONLY to rewards in `Published` state whose business
 * is `Active`. It does NOT filter by explorer level or by stock, and the
 * contract carries no `minLevelRequired`, no stock field and no image
 * field. Every item that arrives here is therefore available: there is no
 * eligibility or inventory data to gate rendering on, and a UI must not
 * invent one.
 *
 * `estimatedValueCop` is a backend `decimal` and stays `z.number()` WITHOUT
 * `.int()` — a price may legitimately arrive with a fraction, even though
 * it is rendered as whole pesos (see `format-cop.ts`). `geoPointsCost` is
 * an `int` and is pinned as such. `menuItemId` is `Guid?`: `null` means the
 * reward is not tied to a specific menu item.
 */
export const rewardSummaryResultSchema = z.object({
  rewardId: z.string(),
  businessId: z.string(),
  title: z.string(),
  description: z.string(),
  geoPointsCost: z.number().int(),
  estimatedValueCop: z.number(),
  menuItemId: z.string().nullable(),
})
export type RewardSummaryResult = z.infer<typeof rewardSummaryResultSchema>

/**
 * `UserReward.Status` — a STRING on the wire (`ToResult` calls
 * `Status.ToString()`), not the numeric enum `ValidationStatus` uses.
 *
 * The union is CLOSED, same criterion as `validationStatusSchema`: an
 * unknown status is a contract change, and failing the parse surfaces it at
 * the transport boundary instead of letting a screen render a state it was
 * never designed for.
 */
export const userRewardStatusSchema = z.enum([
  'PendingReservation',
  'Earned',
  'Redeemed',
  'Expired',
  'Failed',
])
export type UserRewardStatus = z.infer<typeof userRewardStatusSchema>

/**
 * `POST /rewards/{id}/redeem` response (`RewardRedemptionResult`).
 *
 * `qrToken` is the PLAIN token and this response is the only place it ever
 * exists: the backend stores `UserReward.QrTokenHash` and nothing else, the
 * same criterion `RefreshToken` uses. It cannot be re-fetched — not by this
 * endpoint (a second call mints a different redemption and spends GeoPoints
 * again) and not by the status read, whose contract below simply has no
 * field for it. Losing it loses the QR, by design.
 *
 * `qrExpiresAtUtc` is a .NET `DateTime` serialized as a string, so it is
 * kept as `z.string()` — never coerced to a `Date` here, because the same
 * string is what `redemption-status.ts` normalizes before comparing.
 */
export const rewardRedemptionResultSchema = z.object({
  userRewardId: z.string(),
  qrToken: z.string(),
  qrExpiresAtUtc: z.string(),
})
export type RewardRedemptionResult = z.infer<typeof rewardRedemptionResultSchema>

/**
 * `GET /rewards/redemptions/{userRewardId}` response
 * (`UserRewardStatusResult`).
 *
 * Deliberately carries NO token field. Zod's default object parsing strips
 * anything undeclared, so even a future backend that started echoing the
 * plain token could not turn this read into a second source for it.
 *
 * The three timestamps are `DateTime?` and genuinely arrive `null`: a
 * `PendingReservation` has no expiry and no earned instant yet, and only a
 * `Redeemed` reward has `redeemedAtUtc`.
 */
export const userRewardStatusResultSchema = z.object({
  userRewardId: z.string(),
  rewardId: z.string(),
  status: userRewardStatusSchema,
  qrExpiresAtUtc: z.string().nullable(),
  earnedAtUtc: z.string().nullable(),
  redeemedAtUtc: z.string().nullable(),
})
export type UserRewardStatusResult = z.infer<typeof userRewardStatusResultSchema>
