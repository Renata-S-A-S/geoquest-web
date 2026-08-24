import { Skeleton } from '@/shared/components/ui/skeleton'
import { Button } from '@/shared/components/ui/button'
import { useProfile, useLeaderboard } from '@/features/gamification/queries'
import { assembleProfileView } from '@/features/gamification/profile-identity'
import { ProfileView } from '@/features/gamification/profile-view'

/**
 * Container — `/perfil` (WU10). Composes `useProfile()` (progress) and
 * `useLeaderboard()` (identity, via `.me`) in parallel, per spec "Profile
 * View Data Assembly". `profileQuery` failing is treated as fatal (progress
 * is the majority of the screen and `assembleProfileView` requires it);
 * `leaderboardQuery` failing degrades ONLY the identity section
 * (`identityError`), matching spec "One source fails" — never fabricates a
 * username/avatar in its place.
 */
export function ProfilePage() {
  const profileQuery = useProfile()
  const leaderboardQuery = useLeaderboard()

  if (profileQuery.isPending || leaderboardQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (profileQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <span className="font-sans text-xs text-ink">No pudimos cargar tu perfil.</span>
        <Button variant="primary" onClick={() => profileQuery.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const me = leaderboardQuery.data?.me ?? null
  const assembled = assembleProfileView(profileQuery.data, me)

  return (
    <ProfileView
      profile={assembled}
      identityError={leaderboardQuery.isError}
      onRetryIdentity={() => leaderboardQuery.refetch()}
    />
  )
}
