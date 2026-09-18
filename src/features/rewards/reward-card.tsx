import { useTranslation } from 'react-i18next'
import { Pill } from '@/shared/components/ui/pill'
import { useActiveLocale } from '@/shared/lib/locale'
import { formatCop } from '@/features/rewards/format-cop'
import type { RewardSummaryResult } from '@/features/rewards/schemas'

export interface RewardCardProps {
  reward: RewardSummaryResult
  onSelect: (reward: RewardSummaryResult) => void
}

/**
 * Rewards list card — title, description, GeoPoints cost and the estimated
 * COP value. Presentational only: it reports the tap through `onSelect` and
 * knows nothing about where that leads, matching `RouteCard`.
 *
 * Issue #115 turned it into a real affordance. It was deliberately inert
 * until now — there was no redemption screen, so a tappable card would have
 * opened nothing — and `onSelect` is required rather than optional so the
 * dead-affordance state cannot come back by omission.
 *
 * No image: `RewardSummaryResult` carries no image field (see `schemas.ts`),
 * and the card must not invent one. `useActiveLocale()` (not the pure
 * `getActiveLocale()`) because this component renders a locale-formatted
 * value and must re-render on a language switch.
 */
export function RewardCard({ reward, onSelect }: RewardCardProps) {
  const { t } = useTranslation('rewards')
  const locale = useActiveLocale()

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(reward)}
        data-testid={`reward-card-${reward.rewardId}`}
        className="flex w-full flex-col gap-2 rounded-md border border-border bg-surface-raised p-3.5 text-left"
      >
        <div className="flex flex-col gap-1">
          <span className="font-display text-sm text-ink">{reward.title}</span>
          <span className="font-sans text-[11px] text-muted">{reward.description}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Pill variant="solid">{t('list.cost', { points: reward.geoPointsCost })}</Pill>
          <Pill variant="outline">
            {t('list.value', { value: formatCop(reward.estimatedValueCop, locale) })}
          </Pill>
        </div>
      </button>
    </li>
  )
}
