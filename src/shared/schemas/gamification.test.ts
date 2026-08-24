import { describe, expect, it } from 'vitest'
import {
  badgeAwardSchema,
  categorySchema,
  explorerProfileResponseSchema,
  gamingProfileSchema,
  leaderboardEntrySchema,
  leaderboardResponseSchema,
} from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — contracts confirmed against backend source:
 * `GeoQuest.Modules.Gaming/Contracts/{GamificationProfileResult,BadgeAwardResult,
 * LeaderboardEntryResult,LeaderboardResult}.cs` and
 * `GeoQuest.Modules.Identity/Contracts/UpdateExplorerProfileResult.cs`. ASP.NET's
 * default `JsonNamingPolicy.CamelCase` only lowercases the first letter, so
 * `TotalXP` -> `totalXP`, `WeeklyXP` -> `weeklyXP`.
 */

describe('categorySchema', () => {
  it.each([
    'Gastronomia',
    'Naturaleza',
    'HistoriaCultura',
    'Aventura',
    'Arte',
    'Alojamiento',
  ] as const)('accepts the real enum value %s', (value) => {
    expect(categorySchema.parse(value)).toBe(value)
  })

  it('rejects a design-mock placeholder label ("Café")', () => {
    expect(() => categorySchema.parse('Café')).toThrow()
  })

  it('rejects an unknown category', () => {
    expect(() => categorySchema.parse('Deporte')).toThrow()
  })
})

describe('badgeAwardSchema', () => {
  it('accepts { name, awardedAtUtc }', () => {
    const payload = { name: 'Primer paso', awardedAtUtc: '2026-08-20T00:00:00Z' }
    expect(badgeAwardSchema.parse(payload)).toEqual(payload)
  })

  it('rejects a payload missing awardedAtUtc', () => {
    expect(() => badgeAwardSchema.parse({ name: 'Primer paso' })).toThrow()
  })
})

describe('gamingProfileSchema', () => {
  const base = {
    explorerId: 'explorer-1',
    totalXP: 820,
    weeklyXP: 120,
    geoPointsBalance: 40,
    currentLevel: 'Traveler',
    currentStreak: 3,
    longestStreak: 8,
    lastActivityLocalDate: '2026-08-24',
    badges: [],
  }

  it('accepts the real payload shape with an empty badges list', () => {
    expect(gamingProfileSchema.parse(base)).toEqual(base)
  })

  it('accepts a null lastActivityLocalDate (never checked in yet)', () => {
    const payload = { ...base, lastActivityLocalDate: null }
    expect(gamingProfileSchema.parse(payload)).toEqual(payload)
  })

  it('accepts a non-empty badges list', () => {
    const payload = {
      ...base,
      badges: [{ name: 'Primer paso', awardedAtUtc: '2026-08-20T00:00:00Z' }],
    }
    expect(gamingProfileSchema.parse(payload)).toEqual(payload)
  })

  it('rejects a payload missing totalXP', () => {
    const { totalXP: _totalXP, ...rest } = base
    expect(() => gamingProfileSchema.parse(rest)).toThrow()
  })

  it('rejects badges=null (backend never sends it null, always at least [])', () => {
    expect(() => gamingProfileSchema.parse({ ...base, badges: null })).toThrow()
  })
})

describe('leaderboardEntrySchema', () => {
  const base = {
    rank: 1,
    explorerId: 'explorer-1',
    username: 'nachomed',
    avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
    weeklyXP: 500,
  }

  it('accepts the real payload shape', () => {
    expect(leaderboardEntrySchema.parse(base)).toEqual(base)
  })

  it('accepts a null avatarUrl', () => {
    const payload = { ...base, avatarUrl: null }
    expect(leaderboardEntrySchema.parse(payload)).toEqual(payload)
  })

  it('rejects a payload missing rank', () => {
    const { rank: _rank, ...rest } = base
    expect(() => leaderboardEntrySchema.parse(rest)).toThrow()
  })
})

describe('leaderboardResponseSchema', () => {
  const entry = {
    rank: 1,
    explorerId: 'explorer-1',
    username: 'nachomed',
    avatarUrl: null,
    weeklyXP: 500,
  }

  it('accepts a populated top list with me present', () => {
    const payload = { weekStartUtc: '2026-08-24T00:00:00Z', top: [entry], me: entry }
    expect(leaderboardResponseSchema.parse(payload)).toEqual(payload)
  })

  it('accepts an empty top list', () => {
    const payload = { weekStartUtc: '2026-08-24T00:00:00Z', top: [], me: null }
    expect(leaderboardResponseSchema.parse(payload)).toEqual(payload)
  })

  it('accepts me=null (documented nullable despite "always populated")', () => {
    const payload = { weekStartUtc: '2026-08-24T00:00:00Z', top: [entry], me: null }
    expect(leaderboardResponseSchema.parse(payload)).toEqual(payload)
  })

  it('rejects a payload missing top', () => {
    expect(() =>
      leaderboardResponseSchema.parse({ weekStartUtc: '2026-08-24T00:00:00Z', me: null })
    ).toThrow()
  })
})

describe('explorerProfileResponseSchema', () => {
  const base = {
    explorerId: 'explorer-1',
    username: 'nachomed',
    avatarUrl: null,
    interests: ['Naturaleza', 'Aventura'],
    usernameChangedAt: null,
  }

  it('accepts the real payload shape with null avatarUrl/usernameChangedAt', () => {
    expect(explorerProfileResponseSchema.parse(base)).toEqual(base)
  })

  it('accepts a populated avatarUrl and usernameChangedAt', () => {
    const payload = {
      ...base,
      avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
      usernameChangedAt: '2026-08-01T00:00:00Z',
    }
    expect(explorerProfileResponseSchema.parse(payload)).toEqual(payload)
  })

  it('rejects an interests entry that is not a real enum value', () => {
    expect(() => explorerProfileResponseSchema.parse({ ...base, interests: ['Café'] })).toThrow()
  })

  it('accepts an empty interests array', () => {
    const payload = { ...base, interests: [] }
    expect(explorerProfileResponseSchema.parse(payload)).toEqual(payload)
  })
})
