import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { useAuthStore } from '@/shared/stores/auth-store'
import { requestPosition } from '@/features/checkin/media/request-position'
import { RegisterPage } from './register-page'

/**
 * Same mocking approach as `use-checkin.dom.test.tsx` — mock only the
 * browser-touching adapter (`requestPosition`), never `auth-api`, which is
 * exercised for real via MSW. `importOriginal` keeps `GpsReading` typing
 * intact.
 */
vi.mock('@/features/checkin/media/request-position', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/checkin/media/request-position')>()
  return { ...actual, requestPosition: vi.fn() }
})

const baseURL = 'http://localhost:5219'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/registro']}>
        <Routes>
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/onboarding/intereses" element={<div>onboarding-interests-route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function mockRegisterSuccess() {
  let receivedBody: unknown
  server.use(
    http.post(`${baseURL}/auth/register`, async ({ request }) => {
      receivedBody = await request.json()
      return HttpResponse.json({
        accessToken: 'access-token',
        accessTokenExpiresAtUtc: '2026-08-30T00:00:00Z',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAtUtc: '2026-09-06T00:00:00Z',
      })
    })
  )
  return () => receivedBody
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'nachomed' } })
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'nachomed@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
    target: { value: 'password123' },
  })
}

describe('RegisterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAtUtc: null,
      refreshTokenExpiresAtUtc: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the real Spanish copy, including the explicit GPS affordance', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
  })

  it('auto-authenticates and reaches the interests step on successful registration without GPS', async () => {
    const getBody = mockRegisterSuccess()
    renderPage()

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => expect(screen.getByText('onboarding-interests-route')).toBeInTheDocument())
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().accessToken).toBe('access-token')
    expect(getBody()).not.toHaveProperty('latitude')
    expect(getBody()).not.toHaveProperty('longitude')
  })

  it('includes latitude/longitude in the submit payload when the user grants GPS via the explicit affordance', async () => {
    vi.mocked(requestPosition).mockResolvedValue({
      latitude: 6.2442,
      longitude: -75.5812,
      gpsAccuracyMeters: 10,
    })
    const getBody = mockRegisterSuccess()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    await screen.findByText('Ubicación capturada')

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => expect(screen.getByText('onboarding-interests-route')).toBeInTheDocument())
    expect(getBody()).toMatchObject({ latitude: 6.2442, longitude: -75.5812 })
  })

  it('does not block registration when the user denies or dismisses the GPS prompt', async () => {
    vi.mocked(requestPosition).mockRejectedValue(new Error('denied'))
    const getBody = mockRegisterSuccess()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    await screen.findByText('No pudimos acceder a tu ubicación. Podés continuar sin ella.')

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    await waitFor(() => expect(screen.getByText('onboarding-interests-route')).toBeInTheDocument())
    expect(getBody()).not.toHaveProperty('latitude')
    expect(getBody()).not.toHaveProperty('longitude')
  })

  it('shows the client-owned localized duplicate-account message, never the raw server detail (D4)', async () => {
    server.use(
      http.post(`${baseURL}/auth/register`, () =>
        HttpResponse.json(
          {
            title: 'Identity.DuplicateExplorer',
            detail: 'Ya existe un explorador con ese correo electrónico.',
          },
          { status: 409 }
        )
      )
    )
    renderPage()

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(
      await screen.findByText('Ya existe una cuenta con ese correo o nombre de usuario.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Ya existe un explorador con ese correo electrónico.')
    ).not.toBeInTheDocument()
  })

  it('blocks submission with an inline error when the passwords do not match', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'nachomed' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'nachomed@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'different123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
  })
})
