import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IdentityVerificationBanner } from './identity-verification-banner'
import type { RedeemRewardError } from '@/features/rewards/rewards-api'

/**
 * Passive KYC banner. It exists because `POST /rewards/{id}/redeem` can
 * fail with `IdentityNotVerified` and the explorer has no way to act on
 * that: the backend exposes no explorer-facing KYC route at all (KYC runs
 * internally through `StartKycVerificationMessage`, and `GET /explorers/me`
 * does not even return `IsIdentityVerified`).
 *
 * So the "no call to action" assertions below are the point of this suite,
 * not an oversight — a button or link here would be an affordance with
 * nothing behind it. They are also the regression guard for the day
 * somebody adds one before the endpoint exists.
 */
function renderBanner(error: RedeemRewardError) {
  return render(<IdentityVerificationBanner error={error} />)
}

describe('IdentityVerificationBanner', () => {
  it('renders when the mapped redeem error is identityNotVerified', () => {
    renderBanner({ kind: 'identityNotVerified' })

    expect(screen.getByTestId('identity-verification-banner')).toBeInTheDocument()
  })

  it('explains that redeeming needs a verified identity and that verification is not available yet', () => {
    renderBanner({ kind: 'identityNotVerified' })

    const banner = screen.getByTestId('identity-verification-banner')

    expect(banner).toHaveTextContent(/identidad verificada/i)
    expect(banner).toHaveTextContent(/todav[ií]a no/i)
  })

  it('renders no button anywhere, because no explorer-facing KYC endpoint exists', () => {
    renderBanner({ kind: 'identityNotVerified' })

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('renders no link anywhere, for the same reason', () => {
    renderBanner({ kind: 'identityNotVerified' })

    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders no QR, because the redemption QR belongs to an approved redemption, not to this failure', () => {
    const { container } = renderBanner({ kind: 'identityNotVerified' })

    expect(screen.queryByTestId('redemption-qr')).not.toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders nothing for a businessNotActive error, which shares the same 403 status', () => {
    renderBanner({ kind: 'businessNotActive' })

    expect(screen.queryByTestId('identity-verification-banner')).not.toBeInTheDocument()
  })

  it('renders nothing for an unknown error', () => {
    renderBanner({ kind: 'unknown' })

    expect(screen.queryByTestId('identity-verification-banner')).not.toBeInTheDocument()
  })
})
