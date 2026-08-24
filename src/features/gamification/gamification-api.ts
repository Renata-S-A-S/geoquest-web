import { apiClient } from '@/shared/lib/api-client'
import {
  gamingProfileSchema,
  leaderboardResponseSchema,
  type GamingProfile,
  type LeaderboardResponse,
} from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — read transport for the two composed profile
 * sources. Mirrors `checkin-api.ts`: Zod parse in, Zod parse out, calls go
 * through the shared `apiClient` singleton (WU6 interceptors reused, no
 * second axios instance). Neither endpoint has a bespoke error taxonomy —
 * a 404/network error simply rejects, caller decides how to surface it
 * (design decision #2).
 */

/** `GET /gaming/profile`. */
export async function getGamingProfile(): Promise<GamingProfile> {
  const { data } = await apiClient.get('/gaming/profile')
  return gamingProfileSchema.parse(data)
}

/** `GET /gaming/leaderboard`. */
export async function getLeaderboard(): Promise<LeaderboardResponse> {
  const { data } = await apiClient.get('/gaming/leaderboard')
  return leaderboardResponseSchema.parse(data)
}
