import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeFile(name: string, sizeBytes: number, type = 'image/jpeg'): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type })
  return file
}

/**
 * WU10 (gamification) PR5 — spec "Avatar Upload and Removal Are Mutually
 * Exclusive": the `avatarChange` discriminated union (design decision #4)
 * makes replace/remove structurally impossible to combine, not merely
 * validated.
 */
describe('EditProfilePage avatar upload', () => {
  beforeEach(() => {
    // Only stub the two static methods jsdom doesn't implement — replacing
    // the whole global `URL` (e.g. via `vi.stubGlobal`) breaks `new URL()`,
    // which axios/MSW rely on internally to resolve the request URL.
    URL.createObjectURL = vi.fn(() => 'blob:mock-preview')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a preview via URL.createObjectURL when a valid file is chosen', () => {
    renderPage()

    const input = screen.getByLabelText('Cambiar foto de perfil')
    fireEvent.change(input, { target: { files: [makeFile('avatar.jpg', 1024)] } })

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:mock-preview')
  })

  it('blocks files over 5 MB client-side and shows an error, without staging the file', () => {
    renderPage()

    const input = screen.getByLabelText('Cambiar foto de perfil')
    fireEvent.change(input, { target: { files: [makeFile('big.jpg', 6 * 1024 * 1024)] } })

    expect(screen.getByText(/5 ?MB/i)).toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('choosing a file clears a pending "remove" selection', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['explorer', 'me-echo'], {
      explorerId: 'e1',
      username: 'nachomed',
      avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
      interests: [],
      usernameChangedAt: null,
    })
    renderPage(queryClient)

    fireEvent.click(screen.getByRole('button', { name: /quitar foto/i }))
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cambiar foto de perfil'), {
      target: { files: [makeFile('avatar.jpg', 1024)] },
    })

    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument()
  })

  it('choosing "remove" clears a pending file selection', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['explorer', 'me-echo'], {
      explorerId: 'e1',
      username: 'nachomed',
      avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
      interests: [],
      usernameChangedAt: null,
    })
    renderPage(queryClient)

    fireEvent.change(screen.getByLabelText('Cambiar foto de perfil'), {
      target: { files: [makeFile('avatar.jpg', 1024)] },
    })
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:mock-preview')

    fireEvent.click(screen.getByRole('button', { name: /quitar foto/i }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('sends the file under field name "avatar" and never sends removeAvatar in the same request', async () => {
    let receivedFields: string[] = []
    server.use(
      http.patch(`${baseURL}/explorers/me`, async ({ request }) => {
        const form = await request.formData()
        receivedFields = Array.from(form.keys())
        return HttpResponse.json({
          explorerId: 'e1',
          username: 'nachomed',
          avatarUrl: 'https://cdn.example.com/avatars/new.jpg',
          interests: [],
          usernameChangedAt: null,
        })
      })
    )
    renderPage()

    fireEvent.change(screen.getByLabelText('Cambiar foto de perfil'), {
      target: { files: [makeFile('avatar.jpg', 1024)] },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(receivedFields).toContain('avatar'))
    expect(receivedFields).not.toContain('removeAvatar')
  })

  it('disables the submit button while the mutation is pending', async () => {
    server.use(
      http.patch(`${baseURL}/explorers/me`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json({
          explorerId: 'e1',
          username: 'nachomed',
          avatarUrl: null,
          interests: [],
          usernameChangedAt: null,
        })
      })
    )
    renderPage()

    const submit = screen.getByRole('button', { name: /guardar/i })
    fireEvent.click(submit)

    await waitFor(() => expect(submit).toBeDisabled())
  })
})
