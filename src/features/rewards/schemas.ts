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
