import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { EditProfilePage } from './edit-profile-page'

const baseURL = 'http://localhost:5219'

function renderPage(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/perfil/editar']}>
        <EditProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/**
 * WU10 (gamification) PR4 — spec "Username Edit With 30-Day Cooldown" +
 * "Interests Restricted to the Real Backend Enum". Since no read endpoint
 * exists yet (issue #40), the current username/interests/`usernameChangedAt`
 * only exist in this session's `['explorer','me-echo']` cache (seeded by a
 * prior successful PATCH) — an empty cache fails OPEN (design decision #10).
 */
describe('EditProfilePage', () => {
  it('leaves the username field enabled with no cooldown hint when there is no cached echo (fails open)', () => {
    renderPage()

    const input = screen.getByLabelText('Nombre de usuario')
    expect(input).not.toBeDisabled()
  })

  it('disables the username field and shows the exact remaining days when the cached echo is within cooldown', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['explorer', 'me-echo'], {
      explorerId: 'e1',
      username: 'nachomed',
      avatarUrl: null,
      interests: [],
      usernameChangedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    renderPage(queryClient)

    expect(screen.getByLabelText('Nombre de usuario')).toBeDisabled()
    expect(screen.getByText(/25 día/)).toBeInTheDocument()
  })

  it('renders exactly the 6 real interest options as toggleable pills', () => {
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

    const aventura = screen.getByRole('button', { name: 'Aventura' })
    expect(aventura).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(aventura)
    expect(aventura).toHaveAttribute('aria-pressed', 'true')
  })

  it('submits only the 6-enum interests values and the username, never avatar fields', async () => {
    let receivedFields: string[] = []
    let receivedInterests: string[] = []
    server.use(
      http.patch(`${baseURL}/explorers/me`, async ({ request }) => {
        const form = await request.formData()
        receivedFields = Array.from(form.keys())
        receivedInterests = form.getAll('interests') as string[]
        return HttpResponse.json({
          explorerId: 'e1',
          username: 'nuevoUsername',
          avatarUrl: null,
          interests: receivedInterests,
          usernameChangedAt: new Date().toISOString(),
        })
      })
    )
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Aventura' }))
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), {
      target: { value: 'nuevoUsername' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(receivedInterests).toEqual(['Aventura']))
    expect(receivedFields).toContain('username')
    expect(receivedFields).not.toContain('avatar')
    expect(receivedFields).not.toContain('removeAvatar')
  })

  it('shows a form error and does not navigate away when the PATCH fails', async () => {
    server.use(
      http.patch(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(
          {
            title: 'ExplorerProfile.DuplicateUsername',
            detail: 'Ya existe un explorador con ese username.',
          },
          { status: 400 }
        )
      )
    )
    renderPage()

    fireEvent.change(screen.getByLabelText('Nombre de usuario'), {
      target: { value: 'nuevoUsername' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() =>
      expect(screen.getByText('Ya existe un explorador con ese username.')).toBeInTheDocument()
    )
  })
})
