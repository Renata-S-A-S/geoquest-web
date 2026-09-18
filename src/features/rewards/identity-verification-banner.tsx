import { useTranslation } from 'react-i18next'
import type { RedeemRewardError } from '@/features/rewards/rewards-api'

export interface IdentityVerificationBannerProps {
  /** The mapped `POST /rewards/{id}/redeem` failure. Anything other than `identityNotVerified` renders nothing. */
  error: RedeemRewardError
}

/**
 * Explains why a redemption was refused with `IdentityNotVerified`, and
 * stops there.
 *
 * THERE IS NO CALL TO ACTION ON PURPOSE. Do not "fix" the missing button.
 * The backend exposes no explorer-facing KYC surface at all: verification
 * runs internally off `StartKycVerificationMessage` (a message, not a
 * route), there is no start endpoint, no status endpoint and no rejection
 * reason endpoint, and `GET /explorers/me` does not even return
 * `IsIdentityVerified`. A button here could only be wired to nothing, so
 * the banner states the requirement and says plainly that verification
 * cannot be started from the app yet. The CTA lands the day an endpoint
 * does.
 *
 * It gates on `error.kind` rather than on the HTTP status for the reason
 * spelled out in `mapRedeemRewardError`: the backend answers 403 for both
 * `IdentityNotVerified` and `BusinessNotActive`, and showing "verify your
 * identity" to someone whose chosen business is simply inactive would be
 * advice they cannot act on either.
 *
 * Presentational only — it takes the already-mapped error as a prop and
 * runs no query, matching `RewardCard`. Nothing renders this yet; the
 * redeem flow that feeds it is its own slice.
 */
export function IdentityVerificationBanner({ error }: IdentityVerificationBannerProps) {
  const { t } = useTranslation('rewards')

  if (error.kind !== 'identityNotVerified') return null

  return (
    <div
      data-testid="identity-verification-banner"
      role="status"
      className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3.5"
    >
      <span className="font-display text-sm text-ink">{t('identityVerification.title')}</span>
      <span className="font-sans text-[11px] text-muted">{t('identityVerification.body')}</span>
      <span className="font-sans text-[11px] text-muted">
        {t('identityVerification.unavailable')}
      </span>
    </div>
  )
}
