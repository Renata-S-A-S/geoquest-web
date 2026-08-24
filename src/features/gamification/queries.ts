import { useQuery } from '@tanstack/react-query'
import { getGamingProfile, getLeaderboard } from '@/features/gamification/gamification-api'

/**
 * WU10 (gamification) — TanStack Query wiring around `gamification-api.ts`.
 * `QueryClientProvider` is already mounted in `app/providers.tsx` (WU5).
 * Query keys are centralized here so future mutation invalidation
 * (`useUpdateProfile`, added alongside `profile-edit-api.ts`) can't drift
 * out of sync with the hooks that read them.
 */
export const gamificationKeys = {
  profile: ['gaming', 'profile'] as const,
  leaderboard: ['gaming', 'leaderboard'] as const,
}

export function useProfile() {
  return useQuery({
    queryKey: gamificationKeys.profile,
    queryFn: getGamingProfile,
  })
}

export function useLeaderboard() {
  return useQuery({
    queryKey: gamificationKeys.leaderboard,
    queryFn: getLeaderboard,
  })
}
