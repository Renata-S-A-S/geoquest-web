import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Button } from '@/shared/components/ui/button'
import { useProfile, useExplorerProfile } from '@/features/gamification/queries'
import { assembleProfileView } from '@/features/gamification/profile-identity'
import { ProfileView } from '@/features/gamification/profile-view'
import { BadgeDetailModal } from '@/features/gamification/badge-detail-modal'
import type { BadgeAward } from '@/shared/schemas/gamification'

/**
 * Container — `/perfil` (WU10c). Composes `useProfile()` (progress) and
 * `useExplorerProfile()` (identity, `GET /explorers/me`) in parallel, per
 * spec "Profile View Data Assembly". `profileQuery` failing is treated as
 * fatal (progress is the majority of the screen and `assembleProfileView`
 * requires it); `meQuery` failing degrades ONLY the identity section
 * (`identityError`), matching spec "Identity query fails (degraded,
 * non-fatal)" — `me` supplies only 2 of 10 `AssembledProfile` fields, so a
 * failed read never fabricates a username/avatar in its place.
 * `selectedBadge` (design decision #7) is local UI state — no URL, no
 * query — for the badge detail modal.
 */
export function ProfilePage() {
  const { t } = useTranslation('gamification')
  const profileQuery = useProfile()
  const meQuery = useExplorerProfile()
  const [selectedBadge, setSelectedBadge] = useState<BadgeAward | null>(null)

  if (profileQuery.isPending || meQuery.isPending) {
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
        <span className="font-sans text-xs text-ink">{t('profile.loadError')}</span>
        <Button variant="primary" onClick={() => profileQuery.refetch()}>
          {t('profile.retry')}
        </Button>
      </div>
    )
  }

  const assembled = assembleProfileView(profileQuery.data, meQuery.data)

  return (
    <>
      <ProfileView
        profile={assembled}
        identityError={meQuery.isError}
        onRetryIdentity={() => meQuery.refetch()}
        onBadgeClick={setSelectedBadge}
      />
      {selectedBadge && (
        <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      )}
    </>
  )
}
