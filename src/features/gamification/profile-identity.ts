import type {
  BadgeAward,
  ExplorerProfileResponse,
  GamingProfile,
} from '@/shared/schemas/gamification'

/**
 * WU10 (gamification), design decision #3 — the ONE seam that merges
 * `GET /gaming/profile` (progress) with `GET /explorers/me` (identity).
 * The container never learns where identity came from — it just passes
 * whatever `useExplorerProfile()` returns.
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
 * Pure merge — never fabricates identity. `me: undefined` (the identity
 * query pending or failed) yields `username`/`avatarUrl: null`, never a
 * placeholder string.
 */
export function assembleProfileView(
  profile: GamingProfile,
  me: ExplorerProfileResponse | undefined
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
