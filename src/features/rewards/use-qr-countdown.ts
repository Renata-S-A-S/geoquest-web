import { useEffect, useState } from 'react'
import { toEpochMs } from '@/features/rewards/redemption-status'

/**
 * Issue #115 — the live countdown to `qrExpiresAtUtc`.
 *
 * WHY IT DERIVES FROM THE TIMESTAMP: the backend's QR window is
 * `RewardsModuleOptions.QrLifetime`, currently 30 minutes. That value is
 * configuration, not contract — `RewardRedemptionResult` carries an absolute
 * `qrExpiresAtUtc` and no duration field, so the client is never told how
 * long the window is and has no way to learn. A countdown seeded with a
 * hardcoded 30:00 would keep rendering a confident, wrong number from the
 * moment someone edits that setting, and the explorer would only discover
 * it at the counter. Every value here is computed from the deadline the
 * server actually sent.
 *
 * It is a sibling of `effectiveRedemptionStatus`, not a replacement:
 * that function answers "is this still Earned?" at one injected instant,
 * this one answers "how much longer?" continuously for a QR already on
 * screen. Both read the same string through the same `toEpochMs`, so they
 * cannot disagree about the deadline.
 */

/**
 * One second. The countdown is rendered to second precision, so a faster
 * interval would only burn renders, and a slower one would visibly skip
 * numbers.
 */
const TICK_MS = 1_000

const MS_PER_SECOND = 1_000
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3_600

/**
 * Milliseconds left until `expiresAtUtc`, clamped at zero.
 *
 * @param expiresAtUtc The raw `qrExpiresAtUtc` string, designator or not.
 * @param nowEpochMs The instant to measure from. Injected rather than read
 *   from `Date.now()` inside, so the boundary cases are testable without
 *   fake timers — same convention as `effectiveRedemptionStatus`.
 * @returns The remaining milliseconds, `0` once the deadline is reached, or
 *   `null` when the timestamp cannot be parsed at all.
 *
 * The clamp is what keeps a stale screen honest: without it an expired
 * redemption would render a negative, ever-growing "time left".
 *
 * Zero is returned AT the deadline, not one millisecond after, because
 * `effectiveRedemptionStatus` treats that same instant as already
 * `Expired`. A countdown still ticking over a QR the status derivation has
 * killed is the exact contradiction this shared boundary prevents.
 *
 * `null` is deliberately distinct from `0`. An unparseable timestamp means
 * the deadline is UNKNOWN, never that it passed; reporting zero would let a
 * serialization quirk hide a perfectly valid QR. This mirrors
 * `effectiveRedemptionStatus`, which leaves `Earned` intact when it cannot
 * prove staleness — this module only ever expires what it can prove.
 */
export function remainingMsUntil(expiresAtUtc: string, nowEpochMs: number): number | null {
  const expiresAtEpochMs = toEpochMs(expiresAtUtc)
  if (Number.isNaN(expiresAtEpochMs)) return null

  return Math.max(0, expiresAtEpochMs - nowEpochMs)
}

/**
 * Renders remaining milliseconds as `mm:ss`, growing to `h:mm:ss` only when
 * more than an hour is left.
 *
 * The hours segment is unreachable with today's 30-minute window, and that
 * is the reason it exists: this module refuses to assume the window's
 * length anywhere, so the formatter must not overflow or wrap if that
 * setting is ever raised.
 *
 * Seconds round UP. Flooring would display `00:00` for the final 999ms of a
 * still-valid QR, which reads as "expired" to an explorer standing at the
 * counter — and it would disagree with `isExpired`, which only flips at a
 * true zero.
 */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / MS_PER_SECOND)
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR)
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE

  const minutesAndSeconds = `${pad(minutes)}:${pad(seconds)}`
  return hours > 0 ? `${hours}:${minutesAndSeconds}` : minutesAndSeconds
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export interface QrCountdown {
  /** Milliseconds left, `0` once expired, or `null` when the deadline is unparseable. */
  remainingMs: number | null
  /** True only for a PROVEN expiry. An unknown deadline is not an expired one. */
  isExpired: boolean
  /** The `mm:ss` / `h:mm:ss` label, or `null` when there is no countdown to show. */
  label: string | null
}

/**
 * Ticks once per second until `expiresAtUtc`, then stops.
 *
 * Each tick RE-DERIVES the remaining time from the clock instead of
 * subtracting from a stored counter. A decrementing counter drifts away
 * from the real deadline whenever the tab is throttled or the device
 * sleeps — both routine on the phone this runs on — and it would drift in
 * the dangerous direction, reporting time that no longer exists.
 *
 * The interval is cleared from inside the tick that reaches zero, not left
 * running against a `remainingMs === 0` no-op, so an expired QR stops
 * waking the tab entirely. It is never armed at all when the deadline has
 * already passed or cannot be parsed.
 */
export function useQrCountdown(expiresAtUtc: string): QrCountdown {
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    remainingMsUntil(expiresAtUtc, Date.now())
  )

  useEffect(() => {
    // Re-sync before arming: the `useState` initializer only ran on mount,
    // so a changed `expiresAtUtc` would otherwise render last redemption's
    // number for up to a full second.
    const current = remainingMsUntil(expiresAtUtc, Date.now())
    setRemainingMs(current)
    if (current === null || current === 0) return

    const intervalId = setInterval(() => {
      const next = remainingMsUntil(expiresAtUtc, Date.now())
      setRemainingMs(next)
      if (next === null || next === 0) clearInterval(intervalId)
    }, TICK_MS)

    return () => clearInterval(intervalId)
  }, [expiresAtUtc])

  return {
    remainingMs,
    isExpired: remainingMs === 0,
    label: remainingMs === null ? null : formatRemaining(remainingMs),
  }
}
