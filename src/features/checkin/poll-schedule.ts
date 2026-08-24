/**
 * Pure check-in status polling schedule — WU9 (issue #9), design decision #1.
 * Hand-rolled instead of react-query's `refetchInterval` because the
 * schedule is elapsed-time driven and must land in a *distinct* state
 * (`pending-review`) when the hard deadline is reached, which a boolean
 * "stop refetching" return value cannot express on its own.
 *
 * Worst case: 15 fast polls (0-30s) + 9 slow polls (30-120s) = 24 requests
 * over 120s, a hard bound the un-rate-limited `GET /checkins/{id}` needs.
 */
export const POLL_FAST_MS = 2_000
export const POLL_SLOW_MS = 10_000
export const POLL_FAST_UNTIL_MS = 30_000
export const POLL_DEADLINE_MS = 120_000

/**
 * @param elapsedMs Time elapsed since polling started, in milliseconds.
 * @returns The delay before the next poll, or `null` to stop polling
 *   (deadline reached — caller transitions to `pending-review`).
 */
export function nextPollDelayMs(elapsedMs: number): number | null {
  if (elapsedMs >= POLL_DEADLINE_MS) return null
  return elapsedMs < POLL_FAST_UNTIL_MS ? POLL_FAST_MS : POLL_SLOW_MS
}
