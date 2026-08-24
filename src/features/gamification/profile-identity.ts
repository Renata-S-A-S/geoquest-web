import type { BadgeAward, GamingProfile, LeaderboardEntry } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification), design decision #3 — the ONE seam that merges
 * `GET /gaming/profile` (progress) with `GET /gaming/leaderboard`'s `me`
 * entry (identity, a documented stand-in until backend issue #40 ships
 * `GET /explorers/me`). The container never learns where identity came
 * from; retiring #40 means rewriting this function + its `.test.ts` only.
 */
export interface AssembledProfile {
  username: string | null
  avatarUrl: string | null
  totalXP: number
  weeklyXP: number
  geoPointsBalance: number
  currentLevel: string
  currentStreak: number
  longestStreak: number
  lastActivityLocalDate: string | null
  badges: BadgeAward[]
}

/**
 * Pure merge — never fabricates identity. `me: null` (a brand-new explorer
 * with no gamification profile yet, or an identity fetch that failed)
 * yields `username`/`avatarUrl: null`, never a placeholder string.
 */
export function assembleProfileView(
  profile: GamingProfile,
  me: LeaderboardEntry | null
): AssembledProfile {
  return {
    username: me?.username ?? null,
    avatarUrl: me?.avatarUrl ?? null,
    totalXP: profile.totalXP,
    weeklyXP: profile.weeklyXP,
    geoPointsBalance: profile.geoPointsBalance,
    currentLevel: profile.currentLevel,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    lastActivityLocalDate: profile.lastActivityLocalDate,
    badges: profile.badges,
  }
}
