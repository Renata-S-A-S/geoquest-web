import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { useQrCountdown } from '@/features/rewards/use-qr-countdown'

/**
 * Issue #115 — the scannable surface of a redemption: the QR itself, the
 * live countdown to `qrExpiresAtUtc`, and nothing else.
 *
 * Presentational, like `RewardCard` and `IdentityVerificationBanner`: it
 * runs no query and owns no redemption state. It takes the already-minted
 * token and deadline as props, because `POST /rewards/{id}/redeem` must be
 * fired by the screen that owns the explorer's intent, never by a component
 * that merely renders — a re-mount that re-redeemed would spend GeoPoints
 * twice.
 *
 * The countdown is the ONE piece of behavior it does own. A QR and its
 * deadline are a single indivisible claim ("scan this, before then"), and
 * splitting them across a prop boundary would let a future screen render
 * the code without the clock — which is exactly the stale-Earned failure
 * `redemption-status.ts` was written to prevent. `useQrCountdown` is
 * exported and tested on its own, so nothing is hidden by folding it in
 * here.
 *
 * Nothing renders this yet. The redeem screen and its route are the next
 * slice.
 */

/**
 * THE ONLY TWO HARDCODED COLORS IN THE APP'S COMPONENT LAYER, and they are
 * deliberate — `src/test/no-hardcoded-colors.test.ts` allow-lists this file
 * by name for them.
 *
 * Every other color here flows through a `--color-*` token and inverts under
 * `.dark`. A QR must not. A reader decides light module from dark module by
 * luminance contrast off the camera sensor, and the specification is written
 * around dark modules on a light background; inverting it for dark mode
 * produces a code that many hardware and phone scanners reject outright, and
 * that the rest read slower and less reliably. `ink` on `paper` would also
 * only be near-black on near-white, shaving contrast ratio off a code that
 * will be scanned through a phone screen's glare at a counter.
 *
 * So these stay literal in BOTH themes, and `qr-code-panel.dom.test.tsx`
 * asserts they survive `.dark`. The right instinct — "tokenize these" — is
 * the wrong change here: it would make the reward unredeemable for every
 * explorer using dark mode, and it would fail at the counter rather than in
 * CI.
 */
const QR_FOREGROUND = '#000000'
const QR_BACKGROUND = '#FFFFFF'

/**
 * 4 modules, the quiet zone the QR specification requires. `qrcode.react`
 * defaults to 0, which leaves the code's edges flush against whatever is
 * behind it — the one thing a reader uses to locate the symbol at all.
 */
const QR_MARGIN_MODULES = 4

/**
 * Error-correction level M (~15% recoverable). L is the library default and
 * is fine on a clean screen, but this code is scanned off a phone held at an
 * angle, with glare and fingerprints on the glass. M buys that tolerance for
 * a slightly denser symbol, which costs nothing at this render size.
 */
const QR_ERROR_CORRECTION = 'M'

const QR_SIZE_PX = 224

export interface QrCodePanelProps {
  /** The plain token from `POST /rewards/{id}/redeem`. Encoded into the QR and never printed as text. */
  qrToken: string
  /** `RewardRedemptionResult.qrExpiresAtUtc`, raw. The countdown normalizes the .NET designator itself. */
  qrExpiresAtUtc: string
}

export function QrCodePanel({ qrToken, qrExpiresAtUtc }: QrCodePanelProps) {
  const { t } = useTranslation('rewards')
  const { isExpired, label } = useQrCountdown(qrExpiresAtUtc)

  return (
    <div
      data-testid="redemption-qr-panel"
      className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface-raised p-4"
    >
      {isExpired ? (
        /**
         * The QR is REMOVED, not dimmed or overlaid. A visible-but-dead code
         * is still a code someone will point a scanner at, and the rejection
         * happens in front of the cashier rather than here.
         *
         * `isExpired` is true only for a deadline this panel can PROVE has
         * passed; an unparseable `qrExpiresAtUtc` leaves the QR on screen
         * with no countdown, matching `effectiveRedemptionStatus`, which
         * likewise refuses to expire what it cannot prove.
         */
        <p
          data-testid="redemption-qr-expired"
          role="status"
          className="font-sans text-[11px] text-muted"
        >
          {t('redemption.expired')}
        </p>
      ) : (
        <>
          {/*
            An opaque light plaque under the symbol. `marginSize` already
            paints the quiet zone inside the SVG, so this is belt-and-braces
            against a future layout that clips or overlaps the code — in dark
            mode the difference between the two is a scannable reward and an
            unscannable one.
          */}
          <div className="rounded-sm p-3" style={{ backgroundColor: QR_BACKGROUND }}>
            <QRCodeSVG
              data-testid="redemption-qr"
              role="img"
              title={t('redemption.qrTitle')}
              value={qrToken}
              size={QR_SIZE_PX}
              level={QR_ERROR_CORRECTION}
              marginSize={QR_MARGIN_MODULES}
              bgColor={QR_BACKGROUND}
              fgColor={QR_FOREGROUND}
            />
          </div>

          <p className="text-center font-sans text-[11px] text-muted">
            {t('redemption.instructions')}
          </p>

          {label !== null && (
            /**
             * `role="timer"` carries an implicit `aria-live="off"`: the value
             * changes every second, and a polite live region would read the
             * whole countdown aloud over and over.
             */
            <p
              data-testid="redemption-qr-countdown"
              role="timer"
              className="font-display text-sm text-ink"
            >
              {t('redemption.expiresIn', { time: label })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
