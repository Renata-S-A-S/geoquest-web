import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { useOnboardingStore } from '@/shared/stores/onboarding-store'
import { InterestsStepPage } from './interests-step-page'

const baseURL = 'http://localhost:5219'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/onboarding/intereses']}>
        <Routes>
          <Route path="/onboarding/intereses" element={<InterestsStepPage />} />
          <Route path="/" element={<div>map-route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => {
  useOnboardingStore.setState({ hasCompletedOnboarding: false })
})

/**
 * explorer-onboarding-settings PR5 — `/onboarding/intereses`, the last
 * onboarding step (spec "Mandatory Interest Selection"). Reuses
 * `INTEREST_CATALOG` (never duplicated) and the existing
 * `useUpdateProfile()` / `PATCH /explorers/me` transport that
 * `/perfil/editar` already exercises.
 */
describe('InterestsStepPage', () => {
  it('renders the 6 catalog interests and keeps continue disabled with none selected', () => {
    renderPage()

    for (const label of [
      'Gastronomía',
      'Naturaleza',
      'Historia y cultura',
      'Aventura',
      'Arte',
      'Alojamiento',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled()
  })

  it('enables continue once at least one interest is selected', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Aventura' }))

    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled()
  })

  it('submits selected interests via PATCH /explorers/me, sets the onboarding flag, and navigates to the map', async () => {
    let receivedInterests: string[] = []
    server.use(
      http.patch(`${baseURL}/explorers/me`, async ({ request }) => {
        const form = await request.formData()
        receivedInterests = form.getAll('interests') as string[]
        return HttpResponse.json({
          explorerId: 'e1',
          username: 'nachomed',
          avatarUrl: null,
          interests: receivedInterests,
          usernameChangedAt: null,
        })
      })
    )
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Aventura' }))
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    await waitFor(() => expect(receivedInterests).toEqual(['Aventura']))
    expect(await screen.findByText('map-route')).toBeInTheDocument()
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true)
  })

  it('keeps the user on the step and does not set the flag when the PATCH fails', async () => {
    server.use(
      http.patch(`${baseURL}/explorers/me`, () =>
        HttpResponse.json({ title: 'Something.Else' }, { status: 400 })
      )
    )
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Aventura' }))
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    await waitFor(() =>
      expect(
        screen.getByText('No pudimos guardar los cambios. Intentá de nuevo en unos minutos.')
      ).toBeInTheDocument()
    )
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false)
    expect(screen.queryByText('map-route')).not.toBeInTheDocument()
  })
})
