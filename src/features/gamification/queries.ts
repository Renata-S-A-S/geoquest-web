import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getGamingProfile, getLeaderboard } from '@/features/gamification/gamification-api'
import { updateExplorerProfile } from '@/features/gamification/profile-edit-api'
import type { ProfilePatchInput } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — TanStack Query wiring around `gamification-api.ts` /
 * `profile-edit-api.ts`. `QueryClientProvider` is already mounted in
 * `app/providers.tsx` (WU5). Query keys are centralized here so `useProfile`
 * / `useLeaderboard` invalidation from `useUpdateProfile.onSuccess` can't
 * drift out of sync with the hooks that read them.
 */
export const gamificationKeys = {
  profile: ['gaming', 'profile'] as const,
  leaderboard: ['gaming', 'leaderboard'] as const,
  /**
   * Design decision #5 — session-only cache for the last successful PATCH
   * echo. Seeded ONLY by `useUpdateProfile.onSuccess`; never read from a GET
   * endpoint (spec "Interests Are Edit-Session-Only Until First Successful
   * Save" — no read endpoint exists yet, issue #40).
   */
  explorerMeEcho: ['explorer', 'me-echo'] as const,
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

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ProfilePatchInput) => updateExplorerProfile(input),
    onSuccess: (result) => {
      queryClient.setQueryData(gamificationKeys.explorerMeEcho, result)
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.profile })
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.leaderboard })
    },
  })
}
