import { useTranslation } from 'react-i18next'
import { Gift } from '@phosphor-icons/react'
import { RewardCard } from '@/features/rewards/reward-card'
import { EmptyState } from '@/shared/components/empty-state'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useRewards } from '@/features/rewards/queries'

/**
 * `/premios` (index) — the section's landing screen. Container: fetches
 * the published catalog via `useRewards()` (`GET /rewards`) and
 * renders one `RewardCard` per `RewardSummaryResult`. Loading/error/empty
 * states mirror `RoutesPage`'s query-driven list pattern.
 *
 * The section title lives in `RewardsLayout`, not here: it is shared with
 * the ranking tab, so rendering it again on this screen would duplicate it.
 */
export function RewardsPage() {
  const { t } = useTranslation('rewards')
  const { data: rewards, isPending, isError, refetch } = useRewards()

  if (isPending) {
    return (
      <div data-testid="rewards-list-loading" className="flex flex-col gap-2 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <span className="font-sans text-xs text-ink">{t('list.loadError')}</span>
        <Button variant="primary" onClick={() => refetch()}>
          {t('list.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
      {rewards.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={t('list.emptyTitle')}
          description={t('list.emptyDescription')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rewards.map((reward) => (
            <RewardCard key={reward.rewardId} reward={reward} />
          ))}
        </ul>
      )}
    </div>
  )
}
