import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { IdentityVerificationBanner } from '@/features/rewards/identity-verification-banner'
import { QrCodePanel } from '@/features/rewards/qr-code-panel'
import { useRedeemReward, useRedemptionStatus, useRewards } from '@/features/rewards/queries'
import { mapRedeemRewardError } from '@/features/rewards/rewards-api'
import { useRedemptionStore } from '@/shared/stores/redemption-store'
import type { RewardRedemptionResult, UserRewardStatus } from '@/features/rewards/schemas'

/**
 * `/premios/:rewardId/canjear` (issue #115, criteria 11.5 and 11.6) — the
 * screen that spends GeoPoints, shows the QR once, and then lets it go.
 *
 * THE ONE RULE EVERYTHING ELSE SERVES: a remount must never redeem again.
 * `POST /rewards/{id}/redeem` reserves and spends the explorer's GeoPoints,
 * and the plain `qrToken` it answers with is the only copy that will ever
 * exist — the backend keeps just `UserReward.QrTokenHash`. So a screen that
 * simply re-ran the mutation on mount to "get the QR back" would charge
 * twice and orphan the first token. It cannot be a retry, ever.
 *
 * What survives leaving the screen is the `userRewardId`, persisted in
 * `redemption-store.ts`. On mount, a stored id means the redemption already
 * exists and the screen READS it through `GET /rewards/redemptions/{id}` —
 * the token-free contract — instead of minting a new one. Only an explicit
 * confirmation ever calls the mutation.
 *
 * The token itself lives in `minted`, plain React state, and nowhere else:
 * not in a query cache (`useRedeemReward` pins `gcTime: 0`), not in a store,
 * not on disk. Dismissing the QR unmounts the screen and destroys it. That
 * is designed behavior, not a gap, which is why `redeem.dismissWarning` and
 * `redeem.heldBody` say so in plain words — an explorer who believes the
 * code is recoverable would wait at a counter for something no endpoint can
 * produce.
 */

/**
 * Statuses a redemption cannot come back from. Reaching one means the
 * persisted pointer is dead weight, so it is dropped and the reward becomes
 * redeemable again — a genuinely new purchase, not a recovery of the old one.
 */
const TERMINAL_STATUSES: readonly UserRewardStatus[] = ['Redeemed', 'Expired', 'Failed']

function isTerminal(status: UserRewardStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function RedeemPage() {
  const { t } = useTranslation('rewards')
  const navigate = useNavigate()
  const { rewardId } = useParams<{ rewardId: string }>()

  const storedUserRewardId = useRedemptionStore((state) =>
    rewardId === undefined ? undefined : state.activeByRewardId[rewardId]
  )
  const rememberRedemption = useRedemptionStore((state) => state.rememberRedemption)
  const forgetRedemption = useRedemptionStore((state) => state.forgetRedemption)

  const [minted, setMinted] = useState<RewardRedemptionResult | null>(null)
  const [terminalStatus, setTerminalStatus] = useState<UserRewardStatus | null>(null)

  // The catalog is a nicety here, not a prerequisite: it only supplies the
  // title and the cost so the confirm step can name what is being bought and
  // what it costs. A missing or still-loading entry degrades to the generic
  // confirmation rather than blocking a redemption the explorer already chose.
  const { data: rewards } = useRewards()
  const reward = rewards?.find((candidate) => candidate.rewardId === rewardId)

  const redeem = useRedeemReward()
  // Disabled while a token is on screen: this mount already holds the
  // redemption, and the read would tell it nothing it does not know.
  const statusQuery = useRedemptionStatus(minted === null ? storedUserRewardId : undefined)

  const status = statusQuery.data?.status
  useEffect(() => {
    if (rewardId === undefined || status === undefined || !isTerminal(status)) return
    // Copied into component state BEFORE the pointer is dropped, so the
    // explorer still reads why the redemption ended instead of the screen
    // silently resetting to "redeem this?" under them.
    setTerminalStatus(status)
    forgetRedemption(rewardId)
  }, [rewardId, status, forgetRedemption])

  if (rewardId === undefined) return <Navigate to="/premios" replace />

  function confirmRedemption(id: string) {
    redeem.mutate(id, {
      onSuccess: (redemption) => {
        // Pointer first, token second. If anything went wrong between the
        // two lines, the recoverable half would already be safe.
        rememberRedemption(id, redemption.userRewardId)
        setMinted(redemption)
      },
    })
  }

  if (minted !== null) {
    return (
      <Screen>
        <QrCodePanel qrToken={minted.qrToken} qrExpiresAtUtc={minted.qrExpiresAtUtc} />
        <p className="font-sans text-[11px] text-muted">{t('redeem.dismissWarning')}</p>
        <Button variant="secondary" onClick={() => navigate('/premios')}>
          {t('redeem.dismiss')}
        </Button>
      </Screen>
    )
  }

  if (terminalStatus !== null) {
    return (
      <Screen>
        <Notice testId="redeem-terminal">{t(`redeem.terminal.${terminalStatus}`)}</Notice>
        {/* Back to the confirm step, never straight to the mutation: a
            second redemption is a second charge and deserves the same
            explicit consent as the first. */}
        <Button variant="primary" onClick={() => setTerminalStatus(null)}>
          {t('redeem.again')}
        </Button>
        <BackToCatalog label={t('redeem.back')} onClick={() => navigate('/premios')} />
      </Screen>
    )
  }

  if (storedUserRewardId !== undefined) {
    if (statusQuery.isPending) {
      return (
        <Screen>
          <Spinner size={30} />
          <span className="font-sans text-xs text-ink">{t('redeem.checking')}</span>
        </Screen>
      )
    }

    // No retry button: a failed READ changes nothing, and the only other
    // action on this screen spends money. Leaving and coming back re-runs it.
    if (statusQuery.isError) {
      return (
        <Screen>
          <Notice testId="redeem-status-error">{t('redeem.statusError')}</Notice>
          <BackToCatalog label={t('redeem.back')} onClick={() => navigate('/premios')} />
        </Screen>
      )
    }

    return (
      <Screen>
        <span className="font-display text-sm text-ink">{t('redeem.heldTitle')}</span>
        <p className="font-sans text-[11px] text-muted">{t('redeem.heldBody')}</p>
        <BackToCatalog label={t('redeem.back')} onClick={() => navigate('/premios')} />
      </Screen>
    )
  }

  if (redeem.isError) {
    const error = mapRedeemRewardError(redeem.error)
    return (
      <Screen>
        {/* Renders for `identityNotVerified` and nothing else, by its own
            design — the other kinds get their own copy below. */}
        <IdentityVerificationBanner error={error} />
        {error.kind !== 'identityNotVerified' && (
          <Notice testId="redeem-error">{t(`redeem.error.${error.kind}`)}</Notice>
        )}
        {/*
          DELIBERATELY NO RETRY BUTTON. `unknown` covers timeouts and dropped
          responses, where the redemption may well have succeeded on the
          server with the token lost in transit; a one-tap "try again" over
          that is a one-tap second charge. Coming back through the catalog
          re-enters the confirm step, which states the cost first.
        */}
        <BackToCatalog label={t('redeem.back')} onClick={() => navigate('/premios')} />
      </Screen>
    )
  }

  return (
    <Screen>
      {reward !== undefined && (
        <>
          <span className="font-display text-sm text-ink">{reward.title}</span>
          <span className="font-sans text-[11px] text-muted">
            {t('redeem.cost', { points: reward.geoPointsCost })}
          </span>
        </>
      )}
      <span className="font-display text-sm text-ink">{t('redeem.confirmTitle')}</span>
      <p className="font-sans text-[11px] text-muted">{t('redeem.confirmBody')}</p>
      <Button
        variant="primary"
        disabled={redeem.isPending}
        onClick={() => confirmRedemption(rewardId)}
      >
        {redeem.isPending ? t('redeem.redeeming') : t('redeem.confirmAction')}
      </Button>
      <BackToCatalog label={t('redeem.back')} onClick={() => navigate('/premios')} />
    </Screen>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-4 text-center">{children}</div>
  )
}

function Notice({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <p data-testid={testId} role="status" className="font-sans text-[11px] text-muted">
      {children}
    </p>
  )
}

function BackToCatalog({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      {label}
    </Button>
  )
}
