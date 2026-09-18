import { describe, expect, it } from 'vitest'
import { effectiveRedemptionStatus } from '@/features/rewards/redemption-status'
import type { UserRewardStatus, UserRewardStatusResult } from '@/features/rewards/schemas'

/**
 * The backend does NOT compute expiry on read:
 * `GetUserRewardStatusQueryHandler.ToResult` returns
 * `userReward.Status.ToString()` with no clock check, and only the async
 * `RewardRedemptionExpirySweepMessage` ever moves a stale row to `Expired`.
 * Between the deadline and that sweep, the wire says `Earned` for a QR every
 * scanner will reject — so the frontend derives expiry itself.
 */
const at = (iso: string) => new Date(iso)

const redemption = (
  status: UserRewardStatus,
  qrExpiresAtUtc: string | null
): UserRewardStatusResult => ({
  userRewardId: 'd41f9a76-5c3e-4b2a-9f18-2e7c6b5a4d3c',
  rewardId: '3c9a1d52-6b04-4f2d-8e77-0a1b2c3d4e5f',
  status,
  qrExpiresAtUtc,
  earnedAtUtc: '2026-09-17T18:00:00Z',
  redeemedAtUtc: null,
})

describe('effectiveRedemptionStatus', () => {
  it('reports Expired for an Earned redemption whose QR deadline has passed', () => {
    const result = effectiveRedemptionStatus(
      redemption('Earned', '2026-09-17T18:30:00Z'),
      at('2026-09-17T18:30:01Z')
    )

    expect(result).toBe('Expired')
  })

  it('reports Expired exactly at the deadline, because qrExpiresAtUtc is an exclusive bound', () => {
    const result = effectiveRedemptionStatus(
      redemption('Earned', '2026-09-17T18:30:00Z'),
      at('2026-09-17T18:30:00Z')
    )

    expect(result).toBe('Expired')
  })

  it('keeps Earned one millisecond before the deadline', () => {
    const result = effectiveRedemptionStatus(
      redemption('Earned', '2026-09-17T18:30:00Z'),
      at('2026-09-17T18:29:59.999Z')
    )

    expect(result).toBe('Earned')
  })

  it('reads a deadline with no timezone designator as UTC, not as runner-local time', () => {
    const naive = redemption('Earned', '2026-09-17T18:30:00')

    expect(effectiveRedemptionStatus(naive, at('2026-09-17T18:30:01Z'))).toBe('Expired')
    expect(effectiveRedemptionStatus(naive, at('2026-09-17T18:29:59Z'))).toBe('Earned')
  })

  it('keeps Earned when qrExpiresAtUtc is null, since there is no deadline to prove passed', () => {
    const result = effectiveRedemptionStatus(redemption('Earned', null), at('2030-01-01T00:00:00Z'))

    expect(result).toBe('Earned')
  })

  it('keeps Earned when qrExpiresAtUtc is unparseable, rather than guessing Expired', () => {
    const result = effectiveRedemptionStatus(
      redemption('Earned', 'not-a-timestamp'),
      at('2030-01-01T00:00:00Z')
    )

    expect(result).toBe('Earned')
  })

  it('leaves Redeemed alone even past the deadline, because the reward was already used', () => {
    const result = effectiveRedemptionStatus(
      redemption('Redeemed', '2026-09-17T18:30:00Z'),
      at('2030-01-01T00:00:00Z')
    )

    expect(result).toBe('Redeemed')
  })

  it.each<UserRewardStatus>(['PendingReservation', 'Expired', 'Failed'])(
    'leaves %s alone past the deadline, since only Earned can show a QR',
    (status) => {
      const result = effectiveRedemptionStatus(
        redemption(status, '2026-09-17T18:30:00Z'),
        at('2030-01-01T00:00:00Z')
      )

      expect(result).toBe(status)
    }
  )
})
