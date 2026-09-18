import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatRemaining,
  remainingMsUntil,
  useQrCountdown,
} from '@/features/rewards/use-qr-countdown'

/**
 * Issue #115 — the live half of the QR deadline.
 *
 * `redemption-status.ts` answers "is this redemption still Earned?" at one
 * injected instant. This module answers "how much longer?", continuously,
 * for a QR that is already on screen. The two must never disagree, so both
 * read the SAME timestamp and neither one knows how long the backend's
 * window is.
 *
 * The 30-minute window is `RewardsModuleOptions.QrLifetime`, a backend
 * configuration value, not a contract term: it appears nowhere in
 * `RewardRedemptionResult`. A client that counted down from a hardcoded
 * 30:00 would keep showing a confident, wrong number the day someone edits
 * that setting, so every assertion below feeds a DIFFERENT window and
 * expects the countdown to follow the timestamp.
 */

// A whole-second base instant keeps the expected `mm:ss` strings exact.
const NOW_ISO = '2026-09-17T12:00:00Z'
const NOW_MS = Date.parse(NOW_ISO)

/** `NOW_MS + minutes`, formatted the way the backend serializes a `DateTime`: WITH a `Z`. */
function isoInMinutes(minutes: number): string {
  return new Date(NOW_MS + minutes * 60_000).toISOString()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('remainingMsUntil', () => {
  it('derives the remaining time from the timestamp, not from an assumed window', () => {
    // Three different windows, none of them 30 minutes. If the countdown
    // ever hardcodes a lifetime, at most one of these can still pass.
    expect(remainingMsUntil(isoInMinutes(45), NOW_MS)).toBe(45 * 60_000)
    expect(remainingMsUntil(isoInMinutes(5), NOW_MS)).toBe(5 * 60_000)
    expect(remainingMsUntil(isoInMinutes(90), NOW_MS)).toBe(90 * 60_000)
  })

  it('clamps at zero instead of going negative once the deadline has passed', () => {
    expect(remainingMsUntil(isoInMinutes(-1), NOW_MS)).toBe(0)
    expect(remainingMsUntil(isoInMinutes(-600), NOW_MS)).toBe(0)
  })

  it('returns zero exactly at the deadline, matching effectiveRedemptionStatus', () => {
    // `redemption-status.ts` treats the deadline as an EXCLUSIVE bound: at
    // exactly `qrExpiresAtUtc` the redemption already reads `Expired`. The
    // countdown must hit zero on the same instant, or the screen would show
    // a running clock over a QR the status derivation already killed.
    expect(remainingMsUntil(NOW_ISO, NOW_MS)).toBe(0)
  })

  it('reads a designator-less .NET DateTime as UTC, not as local time', () => {
    // `UserReward.QrExpiresAtUtc` is a .NET `DateTime`, not a
    // `DateTimeOffset`, so `System.Text.Json` can drop the trailing `Z` —
    // and `Date.parse` then reads the string as LOCAL time. This runner sits
    // at UTC-5, so an unnormalized parse reports 5 hours of extra life on a
    // QR that is already dead.
    expect(remainingMsUntil('2026-09-17T12:30:00', NOW_MS)).toBe(30 * 60_000)
    expect(remainingMsUntil('2026-09-17T11:30:00', NOW_MS)).toBe(0)
  })

  it('accepts an explicit numeric offset without re-appending a Z', () => {
    expect(remainingMsUntil('2026-09-17T07:30:00-05:00', NOW_MS)).toBe(30 * 60_000)
  })

  it('returns null for an unparseable timestamp rather than reporting zero', () => {
    // Null means "the deadline is unknown", NOT "the deadline passed". Same
    // fail-safe direction as `effectiveRedemptionStatus`, which leaves an
    // `Earned` status intact when it cannot prove staleness: a countdown
    // that cannot be computed must not be the thing that hides a live QR.
    expect(remainingMsUntil('not-a-date', NOW_MS)).toBeNull()
    expect(remainingMsUntil('', NOW_MS)).toBeNull()
  })
})

describe('formatRemaining', () => {
  it.each([
    [0, '00:00'],
    [1_000, '00:01'],
    [65_000, '01:05'],
    [30 * 60_000, '30:00'],
  ] as const)('renders %sms as %s', (remainingMs, expected) => {
    expect(formatRemaining(remainingMs)).toBe(expected)
  })

  it('grows an hours segment when the window is longer than an hour', () => {
    // Not reachable with today's 30-minute backend window, and that is
    // precisely the point: the formatter must not truncate or wrap around
    // if that setting is ever raised.
    expect(formatRemaining(90 * 60_000)).toBe('1:30:00')
    expect(formatRemaining(3 * 60 * 60_000)).toBe('3:00:00')
  })

  it('rounds partial seconds UP, so it never shows 00:00 while time remains', () => {
    // Floor would display 00:00 for the final 999ms of a still-valid QR.
    expect(formatRemaining(1)).toBe('00:01')
    expect(formatRemaining(59_001)).toBe('01:00')
  })
})

describe('useQrCountdown', () => {
  /** Installs the fake clock at `NOW_ISO` before the hook's first render reads it. */
  function renderCountdown(expiresAtUtc: string) {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(NOW_MS)
    return renderHook(() => useQrCountdown(expiresAtUtc))
  }

  it('starts at the remaining time the timestamp implies', () => {
    const { result } = renderCountdown(isoInMinutes(45))

    expect(result.current.remainingMs).toBe(45 * 60_000)
    expect(result.current.label).toBe('45:00')
    expect(result.current.isExpired).toBe(false)
  })

  it('ticks down once per second', () => {
    const { result } = renderCountdown(isoInMinutes(45))

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(result.current.label).toBe('44:59')

    act(() => {
      vi.advanceTimersByTime(59_000)
    })
    expect(result.current.label).toBe('44:00')
  })

  it('stops at zero and reports expiry instead of going negative', () => {
    const { result } = renderCountdown(isoInMinutes(2))

    act(() => {
      vi.advanceTimersByTime(10 * 60_000)
    })

    expect(result.current.remainingMs).toBe(0)
    expect(result.current.label).toBe('00:00')
    expect(result.current.isExpired).toBe(true)
  })

  it('clears its interval once it reaches zero, so a dead QR stops waking the tab', () => {
    renderCountdown(isoInMinutes(2))

    act(() => {
      vi.advanceTimersByTime(2 * 60_000)
    })

    expect(vi.getTimerCount()).toBe(0)
  })

  it('arms no interval at all for an already-expired timestamp', () => {
    const { result } = renderCountdown(isoInMinutes(-5))

    expect(result.current.isExpired).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its interval on unmount, leaving no timer behind', () => {
    const { unmount } = renderCountdown(isoInMinutes(45))

    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports an unknown deadline as null rather than as expired', () => {
    const { result } = renderCountdown('not-a-date')

    expect(result.current.remainingMs).toBeNull()
    expect(result.current.label).toBeNull()
    expect(result.current.isExpired).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('re-derives from the clock each tick instead of subtracting its own elapsed count', () => {
    // A hook that decremented a stored counter would drift against the real
    // deadline whenever the tab is throttled or the device sleeps. Jumping
    // the system clock forward without firing the matching number of
    // intervals is exactly that scenario: one tick must be enough to land
    // on the true remaining time.
    const { result } = renderCountdown(isoInMinutes(45))

    act(() => {
      vi.setSystemTime(NOW_MS + 20 * 60_000)
      vi.advanceTimersByTime(1_000)
    })

    expect(result.current.label).toBe('24:59')
  })
})
