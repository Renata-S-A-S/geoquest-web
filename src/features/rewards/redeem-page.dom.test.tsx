import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { useRedemptionStore } from '@/shared/stores/redemption-store'
import { RedeemPage } from '@/features/rewards/redeem-page'
import type { RewardSummaryResult, UserRewardStatus } from '@/features/rewards/schemas'

/**
 * Issue #115, criteria 11.5 and 11.6 — `/premios/:rewardId/canjear`.
 *
 * The suite is built around ONE hazard: `POST /rewards/{id}/redeem` spends
 * the explorer's GeoPoints, and the plain `qrToken` it answers with exists
 * nowhere else and can never be re-fetched. A screen that redeemed on mount
 * would charge twice for every remount, so every test that touches the
 * redeem path counts the requests that actually left, not just the pixels
 * that arrived — `calls.redeem` is the real assertion in most of them.
 */
const baseURL = TEST_API_BASE_URL

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateSpy }
})

const REWARD_ID = 'b8f4d3c2-1a05-4e77-9c31-6d2f8e4a7b10'
const USER_REWARD_ID = '7f1c9d20-3a58-4b6e-8c04-5e9a1f2d6b73'
const QR_TOKEN = 'plain-token-minted-exactly-once'

const reward: RewardSummaryResult = {
  rewardId: REWARD_ID,
  businessId: '3c1e9a77-5b42-4f08-b6d9-08a1c2e5f734',
  title: 'Café de la casa gratis',
  description: 'Un café filtrado de cortesía en tu próxima visita.',
  geoPointsCost: 500,
  estimatedValueCop: 8000,
  menuItemId: null,
}

const calls = { redeem: 0, status: 0 }

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

function mockCatalog() {
  server.use(http.get(`${baseURL}/rewards`, () => HttpResponse.json([reward])))
}

function mockRedeemSuccess() {
  server.use(
    http.post(`${baseURL}/rewards/${REWARD_ID}/redeem`, () => {
      calls.redeem += 1
      return HttpResponse.json({
        userRewardId: USER_REWARD_ID,
        qrToken: QR_TOKEN,
        qrExpiresAtUtc: inMinutes(30),
      })
    })
  )
}

function mockRedeemFailure(title: string, status: number) {
  server.use(
    http.post(`${baseURL}/rewards/${REWARD_ID}/redeem`, () => {
      calls.redeem += 1
      return HttpResponse.json(
        { title, status, detail: 'Backend detail, never rendered.' },
        { status }
      )
    })
  )
}

function mockStatus(status: UserRewardStatus, qrExpiresAtUtc: string | null) {
  server.use(
    http.get(`${baseURL}/rewards/redemptions/${USER_REWARD_ID}`, () => {
      calls.status += 1
      return HttpResponse.json({
        userRewardId: USER_REWARD_ID,
        rewardId: REWARD_ID,
        status,
        qrExpiresAtUtc,
        earnedAtUtc: inMinutes(-5),
        redeemedAtUtc: null,
      })
    })
  )
}

/** Every value currently sitting in `localStorage`, concatenated. */
function persistedBytes(): string {
  return Object.keys(window.localStorage)
    .map((key) => window.localStorage.getItem(key) ?? '')
    .join('')
}

function renderRedeemPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/premios/${REWARD_ID}/canjear`]}>
        <Routes>
          <Route path="/premios/:rewardId/canjear" element={<RedeemPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RedeemPage', () => {
  beforeEach(() => {
    calls.redeem = 0
    calls.status = 0
    navigateSpy.mockClear()
    mockCatalog()
  })

  /**
   * The load-bearing test of the whole slice. Arriving on the screen is not
   * consent to spend GeoPoints, so nothing may leave for `/redeem` until an
   * explicit confirmation.
   */
  it('shows a confirm step and sends no redemption request on mount', async () => {
    mockRedeemSuccess()
    renderRedeemPage()

    expect(await screen.findByRole('button', { name: 'Confirmar canje' })).toBeInTheDocument()
    expect(calls.redeem).toBe(0)
    expect(screen.queryByTestId('redemption-qr-panel')).not.toBeInTheDocument()
  })

  it('names the reward and its GeoPoints cost before asking for confirmation', async () => {
    mockRedeemSuccess()
    renderRedeemPage()

    expect(await screen.findByText(reward.title)).toBeInTheDocument()
    expect(screen.getByText('Se descuentan 500 pts de tu saldo.')).toBeInTheDocument()
  })

  it('redeems once on an explicit confirm, shows the QR, and persists the id but never the token', async () => {
    mockRedeemSuccess()
    renderRedeemPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar canje' }))

    expect(await screen.findByTestId('redemption-qr-panel')).toBeInTheDocument()
    expect(calls.redeem).toBe(1)
    await waitFor(() =>
      expect(useRedemptionStore.getState().activeByRewardId[REWARD_ID]).toBe(USER_REWARD_ID)
    )
    expect(persistedBytes()).toContain(USER_REWARD_ID)
    expect(persistedBytes()).not.toContain(QR_TOKEN)
  })

  /**
   * Criterion 11.5's core clause. Coming back to a redemption already paid
   * for must READ it, never re-mint it: the second `POST` would charge the
   * explorer again and orphan the first token.
   */
  it('reads the redemption status and sends no redemption request when one is already stored', async () => {
    useRedemptionStore.getState().rememberRedemption(REWARD_ID, USER_REWARD_ID)
    mockRedeemSuccess()
    mockStatus('Earned', inMinutes(20))
    renderRedeemPage()

    expect(await screen.findByText('Tu canje sigue activo')).toBeInTheDocument()
    expect(calls.redeem).toBe(0)
    expect(calls.status).toBe(1)
    expect(screen.queryByRole('button', { name: 'Confirmar canje' })).not.toBeInTheDocument()
  })

  /**
   * The token really is gone, and the copy has to say so. An explorer left
   * believing the QR is recoverable would stand at the counter waiting for a
   * code that no endpoint can produce.
   */
  it('says plainly that a dismissed QR cannot be shown again', async () => {
    useRedemptionStore.getState().rememberRedemption(REWARD_ID, USER_REWARD_ID)
    mockStatus('Earned', inMinutes(20))
    renderRedeemPage()

    expect(
      await screen.findByText(
        'El código QR se mostró una sola vez y no se puede recuperar. Vas a poder canjear este premio de nuevo cuando este canje venza.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByTestId('redemption-qr-panel')).not.toBeInTheDocument()
  })

  it('warns before dismissing and leaves the screen when the QR is closed', async () => {
    mockRedeemSuccess()
    renderRedeemPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar canje' }))
    await screen.findByTestId('redemption-qr-panel')

    expect(
      screen.getByText(
        'Al cerrar, el código QR desaparece para siempre: no se guarda en ningún lado y no se puede volver a mostrar.'
      )
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el QR' }))

    expect(navigateSpy).toHaveBeenCalledWith('/premios')
  })

  it('forgets a redemption that reached a terminal state so the reward can be redeemed again', async () => {
    useRedemptionStore.getState().rememberRedemption(REWARD_ID, USER_REWARD_ID)
    mockRedeemSuccess()
    mockStatus('Expired', inMinutes(-1))
    renderRedeemPage()

    expect(await screen.findByText('Este canje venció sin usarse.')).toBeInTheDocument()
    await waitFor(() =>
      expect(useRedemptionStore.getState().activeByRewardId[REWARD_ID]).toBeUndefined()
    )
    expect(screen.getByRole('button', { name: 'Canjear de nuevo' })).toBeInTheDocument()
    expect(calls.redeem).toBe(0)
  })

  it('renders the identity banner and no QR when the redemption is refused as unverified', async () => {
    mockRedeemFailure('RequestRewardRedemptionCommand.IdentityNotVerified', 403)
    renderRedeemPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar canje' }))

    expect(await screen.findByTestId('identity-verification-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('redemption-qr-panel')).not.toBeInTheDocument()
    expect(useRedemptionStore.getState().activeByRewardId[REWARD_ID]).toBeUndefined()
  })

  /**
   * "Something went wrong" would be a lie for both of these. Out of stock is
   * final for now; an inactive business is temporary and the explorer can
   * come back — and neither is the identity problem the 403 they share would
   * suggest if the screen branched on the status code.
   */
  const failures = [
    {
      title: 'Reward.StockExhausted',
      httpStatus: 409,
      copy: 'Se agotaron las unidades de este premio, así que no se pudo generar el canje.',
    },
    {
      title: 'RequestRewardRedemptionCommand.BusinessNotActive',
      httpStatus: 403,
      copy: 'El comercio no está activo en este momento, así que no acepta canjes. Probá de nuevo cuando vuelva a estarlo.',
    },
  ]

  it.each(failures)('explains a $title refusal in its own words', async (failure) => {
    mockRedeemFailure(failure.title, failure.httpStatus)
    renderRedeemPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar canje' }))

    expect(await screen.findByText(failure.copy)).toBeInTheDocument()
    expect(screen.queryByTestId('identity-verification-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('redemption-qr-panel')).not.toBeInTheDocument()
  })
})
