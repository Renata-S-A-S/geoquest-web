import { describe, expect, it } from 'vitest'
import { usernameCooldown } from '@/features/gamification/username-cooldown'

/**
 * WU10 (gamification), design decision #10 / Design Risks R1b — 30-day
 * cooldown, transcribed from `Domain/Explorer.cs`'s `UsernameChangeCooldownDays`
 * + `ChangeUsername`. The server remains authority
 * (`Explorer.UsernameChangeCooldownActive` is still mapped by
 * `mapProfilePatchError`); this is only a proactive UI hint. Unknown
 * `usernameChangedAt` (no echo yet, issue #40) fails OPEN — field enabled,
 * server rejects if actually still on cooldown.
 */
const now = new Date('2026-08-24T00:00:00Z')

function daysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('usernameCooldown', () => {
  it('day 0 (just changed) -> locked, 30 days remaining', () => {
    expect(usernameCooldown(daysAgo(0), now)).toEqual({ locked: true, daysRemaining: 30 })
  })

  it('day 29 -> still locked, 1 day remaining', () => {
    expect(usernameCooldown(daysAgo(29), now)).toEqual({ locked: true, daysRemaining: 1 })
  })

  it('day 30 -> no longer locked', () => {
    expect(usernameCooldown(daysAgo(30), now)).toEqual({ locked: false, daysRemaining: 0 })
  })

  it('day 31 -> no longer locked', () => {
    expect(usernameCooldown(daysAgo(31), now)).toEqual({ locked: false, daysRemaining: 0 })
  })

  it('null usernameChangedAt fails OPEN — never locked client-side', () => {
    expect(usernameCooldown(null, now)).toEqual({ locked: false, daysRemaining: 0 })
  })
})
