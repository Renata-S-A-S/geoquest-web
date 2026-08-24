import { describe, expect, it } from 'vitest'
import { assembleProfileView } from '@/features/gamification/profile-identity'
import type { ExplorerProfileResponse, GamingProfile } from '@/shared/schemas/gamification'

/**
 * WU10c — the ONE seam that merges `GET /gaming/profile` (progress) with
 * `GET /explorers/me` (identity, now a genuine read endpoint — no longer a
 * `GET /gaming/leaderboard`-derived stand-in).
 */

const profile: GamingProfile = {
  explorerId: 'explorer-1',
  totalXP: 820,
  weeklyXP: 120,
  geoPointsBalance: 40,
  currentLevel: 'Traveler',
  currentStreak: 3,
  longestStreak: 8,
  lastActivityLocalDate: '2026-08-24',
  badges: [{ name: 'Primer paso', awardedAtUtc: '2026-08-20T00:00:00Z' }],
}

const me: ExplorerProfileResponse = {
  explorerId: 'explorer-1',
  username: 'nachomed',
  avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
  interests: ['Naturaleza'],
  usernameChangedAt: null,
}

describe('assembleProfileView', () => {
  it('merges identity (username/avatarUrl) from me with progress from profile', () => {
    const assembled = assembleProfileView(profile, me)

    expect(assembled).toEqual({
      username: 'nachomed',
      avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
      totalXP: 820,
      weeklyXP: 120,
      geoPointsBalance: 40,
      currentLevel: 'Traveler',
      currentStreak: 3,
      longestStreak: 8,
      lastActivityLocalDate: '2026-08-24',
      badges: profile.badges,
    })
  })

  it('does not fabricate identity when me is undefined (identity read still pending or failed)', () => {
    const assembled = assembleProfileView(profile, undefined)

    expect(assembled.username).toBeNull()
    expect(assembled.avatarUrl).toBeNull()
    expect(assembled.totalXP).toBe(820)
    expect(assembled.badges).toEqual(profile.badges)
  })

  it('does not fabricate an avatar when me has a null avatarUrl (never uploaded one)', () => {
    const assembled = assembleProfileView(profile, { ...me, avatarUrl: null })

    expect(assembled.username).toBe('nachomed')
    expect(assembled.avatarUrl).toBeNull()
  })

  it('passes an empty badges list through unchanged', () => {
    const assembled = assembleProfileView({ ...profile, badges: [] }, me)

    expect(assembled.badges).toEqual([])
  })
})
