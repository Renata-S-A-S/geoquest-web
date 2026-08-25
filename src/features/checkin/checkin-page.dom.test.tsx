import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18next from 'i18next'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckinPage } from '@/features/checkin/checkin-page'
import {
  useCheckin,
  type CheckinState,
  type UseCheckinResult,
} from '@/features/checkin/use-checkin'
import { useCheckinStore } from '@/shared/stores/checkin-store'

const fakeSelectedPlace = { placeId: 'place-1', placeName: 'El Cielo' }

/**
 * Props-driven per design testing strategy: `useCheckin` is mocked entirely
 * so each state kind's copy is verified in isolation, without needing a real
 * camera/GPS/network round trip (that's `use-checkin.dom.test.ts`'s job).
 */
vi.mock('@/features/checkin/use-checkin', () => ({ useCheckin: vi.fn() }))

function mockUseCheckin(state: CheckinState, overrides: Partial<UseCheckinResult> = {}) {
  vi.mocked(useCheckin).mockReturnValue({
    state,
    videoRef: { current: null },
    capture: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CheckinPage />
    </MemoryRouter>
  )
}

/**
 * WU003b (PR3) — mounts `CheckinPage` at `/checkin` alongside a real `/`
 * route so the redirect-guard tests can assert where navigation actually
 * lands, not just that the check-in form disappeared.
 */
function renderAtCheckinRoute() {
  return render(
    <MemoryRouter initialEntries={['/checkin']}>
      <Routes>
        <Route path="/checkin" element={<CheckinPage />} />
        <Route path="/" element={<div>home-route</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CheckinPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: a place is selected, matching the normal navigation-from-map
    // flow. Individual tests override this to exercise the redirect guard.
    useCheckinStore.setState({ selectedPlace: fakeSelectedPlace })
  })

  it('renders the requesting-permissions loading copy', () => {
    mockUseCheckin({ kind: 'requesting-permissions' })
    renderPage()
    expect(screen.getByText('Pidiendo acceso a la cámara y al GPS…')).toBeInTheDocument()
  })

  it('renders the camera capture button when state is "camera"', () => {
    mockUseCheckin({ kind: 'camera' })
    renderPage()
    expect(screen.getByRole('button', { name: 'Tomar foto de check-in' })).toBeInTheDocument()
  })

  it('renders a permission-denied message for the camera device with a retry action', () => {
    const retry = vi.fn()
    mockUseCheckin({ kind: 'permission-denied', device: 'camera' }, { retry })
    renderPage()
    expect(screen.getByText('Necesitamos acceso a tu cámara')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Reintentar' }).click()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('renders a permission-denied message for the location device', () => {
    mockUseCheckin({ kind: 'permission-denied', device: 'location' })
    renderPage()
    expect(screen.getByText('Necesitamos acceso a tu ubicación')).toBeInTheDocument()
  })

  it('renders the sending state copy', () => {
    mockUseCheckin({ kind: 'sending', step: 'upload' })
    renderPage()
    expect(screen.getByText('Validando tu check-in…')).toBeInTheDocument()
  })

  it('renders the pending (polling) state copy', () => {
    mockUseCheckin({ kind: 'pending', checkInId: 'abc' })
    renderPage()
    expect(screen.getByText('Estamos revisando tu foto…')).toBeInTheDocument()
  })

  it('renders the pending-review state copy', () => {
    mockUseCheckin({ kind: 'pending-review', checkInId: 'abc' })
    renderPage()
    expect(screen.getByText('Tu check-in quedó en revisión manual')).toBeInTheDocument()
  })

  it('renders the approved state with the awarded xp, geo points, and captured place name', () => {
    mockUseCheckin({ kind: 'approved', xpAwarded: 50, geoPointsAwarded: 10, placeName: 'El Cielo' })
    renderPage()
    expect(screen.getByText('+50 XP')).toBeInTheDocument()
    expect(screen.getByText(/\+10 GeoPoints/)).toBeInTheDocument()
    expect(screen.getAllByText('El Cielo').length).toBeGreaterThan(0)
  })

  it('renders the generic content-moderation message for rejected-content, never a rule-specific message', () => {
    mockUseCheckin({ kind: 'rejected-content' })
    renderPage()
    expect(screen.getByText('No pudimos validar la foto.')).toBeInTheDocument()
    expect(
      screen.queryByText('Estás demasiado lejos del lugar. Acercate y probá de nuevo.')
    ).not.toBeInTheDocument()
  })

  it('renders the specific rule message for rejected-rule', () => {
    mockUseCheckin({ kind: 'rejected-rule', rule: 'OutOfRadius' })
    renderPage()
    expect(
      screen.getByText('Estás demasiado lejos del lugar. Acercate y probá de nuevo.')
    ).toBeInTheDocument()
  })

  it('renders a retry button that calls retry() for a generic error state', () => {
    const retry = vi.fn()
    mockUseCheckin({ kind: 'error', message: 'Algo salió mal' }, { retry })
    renderPage()
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Intentar de nuevo' }).click()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('renders English copy after the active language switches (EN-switch test)', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    mockUseCheckin({ kind: 'camera' })
    renderPage()

    expect(screen.getByRole('button', { name: 'Take check-in photo' })).toBeInTheDocument()
  })

  it('translates the typed rule rejection message to English (EN-switch test)', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    mockUseCheckin({ kind: 'rejected-rule', rule: 'OutOfRadius' })
    renderPage()

    expect(
      screen.getByText("You're too far from the place. Get closer and try again.")
    ).toBeInTheDocument()
  })

  it('redirects to / when there is no selectedPlace snapshot at mount', () => {
    useCheckinStore.setState({ selectedPlace: null })
    mockUseCheckin({ kind: 'camera' })

    renderAtCheckinRoute()

    expect(screen.getByText('home-route')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tomar foto de check-in' })).not.toBeInTheDocument()
  })

  it('does not redirect if selectedPlace clears mid-flow after mount (mount-time snapshot, not reactive)', () => {
    useCheckinStore.setState({ selectedPlace: fakeSelectedPlace })
    mockUseCheckin({ kind: 'approved', xpAwarded: 50, geoPointsAwarded: 10, placeName: 'El Cielo' })

    renderAtCheckinRoute()

    // Simulates `clearSelectedPlace()` firing mid-flow once the check-in
    // resolves (design decision #11) — the guard must ignore this because
    // it already captured its snapshot at mount (design decision #12).
    act(() => {
      useCheckinStore.getState().clearSelectedPlace()
    })

    expect(screen.queryByText('home-route')).not.toBeInTheDocument()
    expect(screen.getByText('+50 XP')).toBeInTheDocument()
  })
})
