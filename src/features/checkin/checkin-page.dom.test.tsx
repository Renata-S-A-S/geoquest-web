import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckinPage } from '@/features/checkin/checkin-page'
import { useCheckin, type CheckinState, type UseCheckinResult } from '@/features/checkin/use-checkin'

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
    </MemoryRouter>,
  )
}

describe('CheckinPage', () => {
  beforeEach(() => vi.resetAllMocks())

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

  it('renders the approved state with the awarded xp and geo points', () => {
    mockUseCheckin({ kind: 'approved', xpAwarded: 50, geoPointsAwarded: 10 })
    renderPage()
    expect(screen.getByText('+50 XP')).toBeInTheDocument()
    expect(screen.getByText(/\+10 GeoPoints/)).toBeInTheDocument()
  })

  it('renders the generic content-moderation message for rejected-content, never a rule-specific message', () => {
    mockUseCheckin({ kind: 'rejected-content' })
    renderPage()
    expect(screen.getByText('No pudimos validar la foto.')).toBeInTheDocument()
    expect(
      screen.queryByText('Estás demasiado lejos del lugar. Acercate y probá de nuevo.'),
    ).not.toBeInTheDocument()
  })

  it('renders the specific rule message for rejected-rule', () => {
    mockUseCheckin({ kind: 'rejected-rule', rule: 'OutOfRadius' })
    renderPage()
    expect(
      screen.getByText('Estás demasiado lejos del lugar. Acercate y probá de nuevo.'),
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
})
