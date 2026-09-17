import { useTranslation } from 'react-i18next'
import { Pill } from '@/shared/components/ui/pill'
import { useActiveLocale } from '@/shared/lib/locale'
import { formatCop } from '@/features/rewards/format-cop'
import type { RewardSummaryResult } from '@/features/rewards/schemas'

export interface RewardCardProps {
  reward: RewardSummaryResult
}

/**
 * Rewards list card — title, description, GeoPoints cost and the estimated
 * COP value. Presentational only, and deliberately not tappable: no reward
 * detail or redemption screen exists yet (it is tracked as its own slice),
 * so a card that opened nothing would be a dead affordance. That is why
 * there is no `onSelect` prop, unlike `RouteCard`.
 *
 * No image: `RewardSummaryResult` carries no image field (see `schemas.ts`),
 * and the card must not invent one. `useActiveLocale()` (not the pure
 * `getActiveLocale()`) because this component renders a locale-formatted
 * value and must re-render on a language switch.
 */
export function RewardCard({ reward }: RewardCardProps) {
  const { t } = useTranslation('rewards')
  const locale = useActiveLocale()

  return (
    <li
      data-testid={`reward-card-${reward.rewardId}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3.5"
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
    </li>
  )
}
