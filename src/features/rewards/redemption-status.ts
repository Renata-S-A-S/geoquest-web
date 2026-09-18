import type { UserRewardStatus, UserRewardStatusResult } from '@/features/rewards/schemas'

/**
 * Issue #115 — the effective status of a redemption, which is NOT always the
 * status the backend sends.
 *
 * WHY THIS EXISTS: `GetUserRewardStatusQueryHandler.ToResult` answers
 * `userReward.Status.ToString()` with no clock check at all. The backend
 * reports the PERSISTED status and never computes expiry on read; only the
 * asynchronous `RewardRedemptionExpirySweepMessage` transitions a stale row
 * to `Expired`. Between the QR deadline and that sweep, the wire keeps
 * saying `Earned` for a token every scanner will reject, and a screen that
 * trusted it would send an explorer to a counter with a dead QR.
 *
 * Kept as a pure function, out of any component, so the rule is testable at
 * its boundaries and every consumer derives the same answer.
 */

/** ISO-8601 timezone designator: a trailing `Z`, or a `+hh:mm` / `-hhmm` offset. */
const TIMEZONE_DESIGNATOR = /(?:Z|[+-]\d{2}:?\d{2})$/i

/**
 * `UserReward.QrExpiresAtUtc` is a .NET `DateTime`, not a `DateTimeOffset`,
 * so `System.Text.Json` can serialize it with no trailing `Z` — and
 * `Date.parse` reads a designator-less date-time as LOCAL time. An explorer
 * in UTC-5 would then see a QR live five hours past its real deadline.
 *
 * Same trap and same fix as `checkin/badge-diff.ts`'s `toEpochMs`. It stays
 * duplicated ACROSS slices — four lines of normalization do not justify
 * coupling rewards to check-in, and neither feature owns a date utility the
 * other should depend on — but it is shared WITHIN this one, which is why
 * it is exported: `use-qr-countdown.ts` reads the very same
 * `qrExpiresAtUtc` string this function judges, and a second copy could
 * drift into disagreeing with this one about when a QR dies. A live
 * countdown and the status derivation must never answer differently.
 *
 * Returns `NaN` for anything unparseable; the caller treats that as "cannot
 * prove the deadline passed", never as "expired".
 */
export function toEpochMs(value: string): number {
  return Date.parse(TIMEZONE_DESIGNATOR.test(value) ? value : value + 'Z')
}

/**
 * @param redemption The parsed `GET /rewards/redemptions/{id}` payload.
 * @param now The instant to judge against. Injected rather than read from
 *   `Date.now()` inside, so the boundary cases are testable without fake
 *   timers.
 *
 * Only `Earned` is ever overridden. It is the single status that puts a
 * scannable QR on screen, so it is the only one where a stale value causes
 * real damage; `Redeemed`, `Expired`, `Failed` and `PendingReservation` are
 * either terminal or pre-QR and are returned untouched.
 *
 * The deadline is treated as an EXCLUSIVE bound: at exactly
 * `qrExpiresAtUtc` the redemption already reads `Expired`. A validity window
 * that ends at T does not include T, and the asymmetry settles the tie —
 * being one instant early costs a refresh, while being one instant late
 * costs a rejected scan in front of the cashier. The frontend clock can also
 * drift against the server's, and this is the direction that fails safe.
 *
 * A `null` or unparseable `qrExpiresAtUtc` leaves `Earned` intact: this
 * derivation only ever downgrades a status it can PROVE is stale, and the
 * real expiry sweep still owns the authoritative transition.
 */
export function effectiveRedemptionStatus(
  redemption: UserRewardStatusResult,
  now: Date
): UserRewardStatus {
  if (redemption.status !== 'Earned' || redemption.qrExpiresAtUtc === null) {
    return redemption.status
  }

  const expiresAtEpochMs = toEpochMs(redemption.qrExpiresAtUtc)
  if (Number.isNaN(expiresAtEpochMs)) return redemption.status

  return now.getTime() >= expiresAtEpochMs ? 'Expired' : 'Earned'
}
