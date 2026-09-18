import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useSubmitRedemptionRating } from '@/features/rewards/queries'
import {
  mapSubmitRatingError,
  REWARD_RATING_VALUES,
  type RewardRating,
} from '@/features/rewards/rewards-api'

export interface RedemptionRatingProps {
  /**
   * The redemption being rated. Its caller passes the id it copied out of
   * the status payload before dropping the persisted pointer — there is no
   * other way back to it once the redemption ends.
   */
  userRewardId: string
}

/**
 * Issue #116 — how the explorer rates a redemption they already used, and
 * the last thing this screen ever asks them.
 *
 * WRITE-ONCE, ON PURPOSE. `POST /rewards/redemptions/{id}/rating` answers
 * 204 and the backend then refuses every later attempt with
 * `UserReward.AlreadyRated`, so a control that kept offering "change it"
 * would be offering something the server will not do. The buttons therefore
 * retire the moment the rating lands, and the screen states the score
 * instead of holding it in an editable field.
 *
 * The 1-5 range is enforced structurally rather than validated. There are
 * exactly `REWARD_RATING_VALUES.length` buttons, typed `RewardRating`, so a
 * 6 cannot be constructed; "nothing chosen yet" is `null` rather than 0, so
 * a 0 cannot be submitted either, and the send button stays disabled until
 * a real score exists. That matches
 * `SubmitRewardExperienceRatingCommandValidator`'s `InclusiveBetween(1, 5)`
 * without restating it as a client-side rule that could drift from it.
 *
 * Selecting is deliberately separate from sending. The redeem step above
 * asks for explicit consent before spending GeoPoints for the same reason:
 * an irreversible action should not be one stray tap away.
 */
export function RedemptionRating({ userRewardId }: RedemptionRatingProps) {
  const { t } = useTranslation('rewards')
  const [score, setScore] = useState<RewardRating | null>(null)
  const submit = useSubmitRedemptionRating(userRewardId)

  const error = submit.isError ? mapSubmitRatingError(submit.error) : null
  // `alreadyRated` is not a failure to try again over: the rating is already
  // recorded, so the control retires exactly as it would after its own 204.
  // Every other kind — `notRedeemed` above all, which only means "not yet" —
  // leaves it standing, because coming back later can genuinely succeed.
  const settled = submit.isSuccess || error?.kind === 'alreadyRated'

  return (
    <div
      data-testid="redemption-rating"
      className="flex flex-col items-center gap-2 rounded-md border border-border bg-surface-raised p-3.5"
    >
      <span className="font-display text-sm text-ink">{t('rating.prompt')}</span>

      {submit.isSuccess && (
        <p role="status" className="font-sans text-[11px] text-muted">
          {t('rating.thanks', { value: score })}
        </p>
      )}

      {error !== null && (
        <p role="status" className="font-sans text-[11px] text-muted">
          {t(`rating.error.${error.kind}`)}
        </p>
      )}

      {!settled && (
        <>
          <div role="group" aria-label={t('rating.prompt')} className="flex gap-1.5">
            {REWARD_RATING_VALUES.map((value) => (
              <Button
                key={value}
                variant={value === score ? 'primary' : 'secondary'}
                aria-label={t('rating.score', { value })}
                aria-pressed={value === score}
                onClick={() => setScore(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <span className="font-sans text-[11px] text-muted">{t('rating.hint')}</span>
          <Button
            variant="primary"
            disabled={score === null || submit.isPending}
            onClick={() => score !== null && submit.mutate(score)}
          >
            {submit.isPending ? t('rating.submitting') : t('rating.submit')}
          </Button>
        </>
      )}
    </div>
  )
}
