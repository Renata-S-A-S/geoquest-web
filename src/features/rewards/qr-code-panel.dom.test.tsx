import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QrCodePanel } from '@/features/rewards/qr-code-panel'

/**
 * Issue #115 — the scannable half of a redemption.
 *
 * Two properties carry this suite, and both are about a physical scanner
 * rather than about React:
 *
 * 1. THE QR IS LITERAL BLACK ON LITERAL WHITE IN BOTH THEMES. Every other
 *    color in this app flows through a `--color-*` token and flips with
 *    `.dark`. A QR must not: a scanner reads luminance contrast off the
 *    camera sensor, and `ink` on `paper` inverted for dark mode is a
 *    light-on-dark code that most readers reject outright. The `.dark`
 *    assertions below are the regression guard for the well-meaning cleanup
 *    that "fixes" the two hex literals into tokens — which is also why
 *    `src/test/no-hardcoded-colors.test.ts` allow-lists this file by name
 *    with a written reason.
 *
 * 2. THE PANEL REFUSES TO SHOW AN EXPIRED QR. `redemption-status.ts` exists
 *    because the backend reports a stale `Earned` between the deadline and
 *    the async expiry sweep; that reasoning is worth nothing if the panel
 *    keeps painting the code anyway once its own countdown hits zero.
 */

const QR_FOREGROUND = '#000000'
const QR_BACKGROUND = '#FFFFFF'

const NOW_MS = Date.parse('2026-09-17T12:00:00Z')
const TOKEN = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function isoInMinutes(minutes: number): string {
  return new Date(NOW_MS + minutes * 60_000).toISOString()
}

/**
 * Renders at a fixed instant. The panel runs a live countdown, so without a
 * pinned clock every expectation below would drift with wall time.
 */
function renderPanel(qrExpiresAtUtc: string) {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(NOW_MS)
  return render(<QrCodePanel qrToken={TOKEN} qrExpiresAtUtc={qrExpiresAtUtc} />)
}

/** The two `<path>` elements `QRCodeSVG` emits: background first, then modules. */
function qrPathFills(container: HTMLElement): string[] {
  return [...container.querySelectorAll('svg path')].map((path) => path.getAttribute('fill') ?? '')
}

afterEach(() => {
  vi.useRealTimers()
  document.documentElement.classList.remove('dark')
})

describe('QrCodePanel', () => {
  it('renders a QR for a live redemption', () => {
    const { container } = renderPanel(isoInMinutes(12))

    expect(screen.getByTestId('redemption-qr')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('paints literal black on literal white in the light theme', () => {
    const { container } = renderPanel(isoInMinutes(12))

    expect(qrPathFills(container)).toEqual([QR_BACKGROUND, QR_FOREGROUND])
  })

  it('paints the SAME literal black on literal white in the dark theme', () => {
    document.documentElement.classList.add('dark')

    const { container } = renderPanel(isoInMinutes(12))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(qrPathFills(container)).toEqual([QR_BACKGROUND, QR_FOREGROUND])
  })

  it('keeps an opaque light plaque behind the code so no theme surface shows through', () => {
    // A transparent background would let the dark theme's `paper` bleed into
    // the quiet zone, which is the part of a QR a reader uses to find the
    // code's edges at all. The background path must span the whole viewBox.
    const { container } = renderPanel(isoInMinutes(12))

    const svg = container.querySelector('svg')
    const viewBox = svg?.getAttribute('viewBox')
    const cells = Number(viewBox?.split(' ').at(-1))
    const backgroundPath = container.querySelector('svg path')

    expect(cells).toBeGreaterThan(0)
    expect(backgroundPath?.getAttribute('d')).toBe(`M0,0 h${cells}v${cells}H0z`)
    expect(backgroundPath?.getAttribute('fill')).toBe(QR_BACKGROUND)
  })

  it('exposes the QR to assistive tech with a name instead of leaving it an unlabeled graphic', () => {
    renderPanel(isoInMinutes(12))

    expect(screen.getByRole('img', { name: /QR/i })).toBeInTheDocument()
  })

  it('never prints the plain token as readable text', () => {
    // The plain `qrToken` exists exactly once, in the redeem response, and
    // the QR is its only intended surface. Rendering it as text would put a
    // copyable secret on screen (and into any screenshot) for no gain.
    const { container } = renderPanel(isoInMinutes(12))

    expect(container.textContent).not.toContain(TOKEN)
  })

  it('shows the remaining time the timestamp implies, not an assumed 30-minute window', () => {
    renderPanel(isoInMinutes(12))

    expect(screen.getByTestId('redemption-qr-countdown')).toHaveTextContent('12:00')
    expect(screen.getByTestId('redemption-qr-countdown')).not.toHaveTextContent('30:00')
  })

  it('labels the countdown in Spanish voseo and tells the explorer what to do with the code', () => {
    renderPanel(isoInMinutes(12))

    expect(screen.getByTestId('redemption-qr-countdown')).toHaveTextContent(/vence en/i)
    expect(screen.getByTestId('redemption-qr-panel')).toHaveTextContent(/mostr[áa]/i)
  })

  it('counts the QR down as the clock runs', async () => {
    renderPanel(isoInMinutes(12))

    await vi.advanceTimersByTimeAsync(60_000)

    expect(screen.getByTestId('redemption-qr-countdown')).toHaveTextContent('11:00')
  })

  it('replaces the QR with an expired notice once the deadline passes while it is on screen', async () => {
    const { container } = renderPanel(isoInMinutes(2))

    expect(screen.getByTestId('redemption-qr')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(2 * 60_000)

    expect(screen.queryByTestId('redemption-qr')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
    expect(screen.getByTestId('redemption-qr-expired')).toBeInTheDocument()
  })

  it('renders no QR at all for a deadline that had already passed on mount', () => {
    const { container } = renderPanel(isoInMinutes(-5))

    expect(screen.queryByTestId('redemption-qr')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
    expect(screen.getByTestId('redemption-qr-expired')).toBeInTheDocument()
  })

  it('still shows the QR when the deadline is unparseable, because unknown is not expired', () => {
    // Same fail-safe direction as `effectiveRedemptionStatus`: a
    // serialization quirk must never be the thing that hides a valid QR.
    // The countdown simply has nothing to display.
    renderPanel('not-a-date')

    expect(screen.getByTestId('redemption-qr')).toBeInTheDocument()
    expect(screen.queryByTestId('redemption-qr-countdown')).not.toBeInTheDocument()
    expect(screen.queryByTestId('redemption-qr-expired')).not.toBeInTheDocument()
  })
})
