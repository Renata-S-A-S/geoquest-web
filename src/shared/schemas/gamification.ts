import { z } from 'zod'

/**
 * Gamification + profile-editing contracts — WU10 (gamification). Mirrors
 * `schemas/checkin.ts`: Zod parse in, Zod parse out. Field names and
 * nullability confirmed against the backend source
 * (`GeoQuest.Modules.Gaming/Contracts/{GamificationProfileResult,
 * BadgeAwardResult,LeaderboardEntryResult,LeaderboardResult}.cs` and
 * `GeoQuest.Modules.Identity/Contracts/UpdateExplorerProfileResult.cs`).
 * ASP.NET's default `JsonNamingPolicy.CamelCase` only lowercases the first
 * character, so `TotalXP` -> `totalXP`, `WeeklyXP` -> `weeklyXP`.
 */

/** Real backend `Category` enum (`SharedKernel.Domain.Taxonomy.Category`) — no other value is valid. */
export const categorySchema = z.enum([
  'Gastronomia',
  'Naturaleza',
  'HistoriaCultura',
  'Aventura',
  'Arte',
  'Alojamiento',
])
export type Category = z.infer<typeof categorySchema>

/**
 * One entry of `GamificationProfileResult.Badges`. The full backend record is
 * `BadgeAwardResult(string Name, string Description, string? IconUrl,
 * DateTime AwardedAtUtc)` — backend issue #41 added `Description` and
 * `IconUrl` and CLOSED on 2026-08-24, so both fields are populated on every
 * response today. This schema declared only `name` + `awardedAtUtc` until
 * issue #153, and because Zod strips undeclared keys the description was
 * silently discarded on every request. Do not narrow this object again
 * without checking the backend contract first.
 *
 * `iconUrl` is parsed because it is part of the contract and costs nothing,
 * but nothing renders it: it is NULL for all 7 seeded badge rows, so icon
 * rendering would be untested code for data that does not exist yet.
 *
 * `description` is Spanish free text stored in the `Badge` table, not a
 * translatable key, so it renders in Spanish even under the `en` locale.
 * That is a known limitation, not an oversight — same precedent as
 * `auth-api.ts` surfacing the server's ProblemDetails `detail` verbatim.
 * Fixing it needs a backend-side localized-copy contract, not a client
 * translation layer guessing at keys.
 */
export const badgeAwardSchema = z.object({
  name: z.string(),
  description: z.string(),
  iconUrl: z.string().nullable(),
  awardedAtUtc: z.string(),
})
export type BadgeAward = z.infer<typeof badgeAwardSchema>

/** `GET /gaming/profile` response. `badges` is never null — an explorer with no badges gets `[]`. */
export const gamingProfileSchema = z.object({
  explorerId: z.string(),
  totalXP: z.number(),
  weeklyXP: z.number(),
  geoPointsBalance: z.number(),
  currentLevel: z.string(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastActivityLocalDate: z.string().nullable(),
  badges: z.array(badgeAwardSchema),
})
export type GamingProfile = z.infer<typeof gamingProfileSchema>

/** One row of `LeaderboardResult.Top` / `.Me`. */
export const leaderboardEntrySchema = z.object({
  rank: z.number(),
  explorerId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  weeklyXP: z.number(),
})
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>

/**
 * `GET /gaming/leaderboard` response. `me` is typed nullable here even
 * though the backend doc claims "always populated for an authenticated
 * explorer with a gamification profile" — a brand-new explorer with no
 * gamification profile yet is a real, documented edge case (spec open
 * question), so the client must not assume presence.
 */
export const leaderboardResponseSchema = z.object({
  weekStartUtc: z.string(),
  top: z.array(leaderboardEntrySchema),
  me: leaderboardEntrySchema.nullable(),
})
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>

/** `PATCH /explorers/me` response (`UpdateExplorerProfileResult`). */
export const explorerProfileResponseSchema = z.object({
  explorerId: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  interests: z.array(categorySchema),
  usernameChangedAt: z.string().nullable(),
})
export type ExplorerProfileResponse = z.infer<typeof explorerProfileResponseSchema>

/**
 * Avatar mutual exclusion is unrepresentable-by-construction (design
 * decision #4), not merely validated: a caller can never build a value that
 * both replaces AND removes the avatar in the same request.
 */
export type AvatarChange = { kind: 'none' } | { kind: 'replace'; file: File } | { kind: 'remove' }

/**
 * Input to `buildProfilePatchForm` (`profile-edit-api.ts`). `interests`
 * omitted means "do not touch"; present (including `[]`) means "full
 * replace" — mirrors the backend's `interestsProvided` distinction
 * (`ExplorersEndpoints.UpdateProfileAsync`).
 */
export interface ProfilePatchInput {
  username?: string
  interests?: Category[]
  avatarChange: AvatarChange
}
