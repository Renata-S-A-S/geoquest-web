import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getGamingProfile, getLeaderboard } from '@/features/gamification/gamification-api'
import { getExplorerProfile, updateExplorerProfile } from '@/features/gamification/profile-edit-api'
import type { ProfilePatchInput } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — TanStack Query wiring around `gamification-api.ts` /
 * `profile-edit-api.ts`. `QueryClientProvider` is already mounted in
 * `app/providers.tsx` (WU5). Query keys are centralized here so
 * `useProfile` / `useExplorerProfile` invalidation from
 * `useUpdateProfile.onSuccess` can't drift out of sync with the hooks that
 * read them.
 */
export const gamificationKeys = {
  profile: ['gaming', 'profile'] as const,
  leaderboard: ['gaming', 'leaderboard'] as const,
  /**
   * WU10c — genuine `GET /explorers/me` read, consumed by both `/perfil`
   * (identity section) and `/perfil/editar` (form prefill). TanStack dedupes
   * on this shared key, so the edit page costs no extra request.
   */
  explorerMe: ['explorer', 'me'] as const,
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

export function useExplorerProfile() {
  return useQuery({
    queryKey: gamificationKeys.explorerMe,
    queryFn: getExplorerProfile,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ProfilePatchInput) => updateExplorerProfile(input),
    onSuccess: (result) => {
      queryClient.setQueryData(gamificationKeys.explorerMe, result)
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.profile })
    },
  })
}
