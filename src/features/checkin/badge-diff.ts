import type { BadgeAward } from '@/shared/schemas/gamification'

/**
 * Issue #108 — "which badge did THIS check-in unlock?", answered by diffing
 * `GET /gaming/profile` before and after the check-in.
 *
 * WHY THIS EXISTS AT ALL: the backend's `CheckInStatusResult` (the shape
 * behind `GET /checkins/{id}`) carries `XpAwarded` and `GeoPointsAwarded`
 * but NO badges field, so there is no atomic "badge unlocked" signal to
 * read. Verified against the backend contract, not inferred.
 *
 * THIS MODULE IS DELIBERATELY DELETABLE. The whole feature is this file
 * plus one persisted store field (`checkin-store.ts`'s `badgeNamesBefore`).
 * When the backend adds `CheckInStatusResult.BadgesAwarded`, delete both and
 * read the awarded names straight off the status response — no other module
 * owns any part of this heuristic.
 *
 * The diff is a heuristic, so it is built to under-claim rather than
 * over-claim: anything it cannot prove belongs to this check-in is dropped,
 * and every caller degrades to the plain XP/GeoPoints screen instead of
 * surfacing an error. A wrong badge in a celebration is worse than no badge.
 */

/** ISO-8601 timezone designator: a trailing `Z`, or a `+hh:mm` / `-hhmm` offset. */
const TIMEZONE_DESIGNATOR = /(?:Z|[+-]\d{2}:?\d{2})$/i

/**
 * Both `CheckInStatusResult.CreatedAt` and `BadgeAwardResult.AwardedAtUtc`
 * are .NET `DateTime` (not `DateTimeOffset`), so `System.Text.Json` can
 * serialize them with no trailing `Z`. `Date.parse` reads a date-time
 * string without a designator as LOCAL time, so a mixed pair (one with `Z`,
 * one without) would be compared across the runner's timezone offset. Both
 * sides are normalized to UTC here so the comparison stays offset-free.
 *
 * Returns `NaN` for anything unparseable; callers treat that as "cannot
 * prove it", never as "zero".
 */
function toEpochMs(value: string): number {
  return Date.parse(TIMEZONE_DESIGNATOR.test(value) ? value : value + 'Z')
}

/** Projects a profile's badge list down to the names the snapshot stores. */
export function badgeNames(badges: BadgeAward[]): string[] {
  return badges.map((award) => award.name)
}

/**
 * Names of the badges this check-in unlocked.
 *
 * @param before Badge names owned when the check-in was submitted, or `null`
 *   when no snapshot was taken. `null` yields an empty list — with no
 *   baseline the diff can prove nothing. An empty array is a REAL snapshot
 *   (an explorer with no badges yet) and is treated as such.
 * @param after The profile's badge list refetched after approval.
 * @param checkinCreatedAt The check-in's server-side `createdAt`. Server
 *   time on both sides of the comparison, never the client clock, so device
 *   skew cannot silently widen or narrow the window.
 *
 * A badge counts as unlocked by this check-in only when it is absent from
 * `before` AND was awarded at or after `checkinCreatedAt`. The timestamp
 * test is AT-or-after rather than strictly-after on purpose: the backend
 * stamps the check-in's `CreatedAt` and the badge's `AwardedAtUtc` inside
 * the same processing pass, so an identical timestamp is the expected
 * shape of a badge this check-in earned — excluding it would drop the most
 * common true positive. Anything older predates the check-in (earned
 * earlier, or on another device against a stale snapshot) and is dropped.
 */
export function diffUnlockedBadges(
  before: string[] | null,
  after: BadgeAward[],
  checkinCreatedAt: string
): string[] {
  if (before === null) return []

  const checkinEpochMs = toEpochMs(checkinCreatedAt)
  if (Number.isNaN(checkinEpochMs)) return []

  const alreadyOwned = new Set(before)

  return after
    .filter((award) => {
      if (alreadyOwned.has(award.name)) return false
      const awardedEpochMs = toEpochMs(award.awardedAtUtc)
      return !Number.isNaN(awardedEpochMs) && awardedEpochMs >= checkinEpochMs
    })
    .map((award) => award.name)
}
