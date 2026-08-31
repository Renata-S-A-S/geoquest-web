import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http, delay } from 'msw'
import i18next from 'i18next'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { EditProfilePage } from './edit-profile-page'
import type { ExplorerProfileResponse } from '@/shared/schemas/gamification'

const baseURL = 'http://localhost:5219'

function meResponse(overrides: Partial<ExplorerProfileResponse> = {}): ExplorerProfileResponse {
  return {
    explorerId: 'e1',
    username: 'nachomed',
    avatarUrl: null,
    interests: [],
    usernameChangedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  server.use(http.get(`${baseURL}/explorers/me`, () => HttpResponse.json(meResponse())))
})

/**
 * Renders `EditProfilePage` and awaits the initial `GET /explorers/me`
 * settle before returning — the form only mounts once that query resolves
 * (WU10c design decision D9), so every test that needs the form present
 * must await this, not assert against the pending skeleton.
 */
async function renderPage(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/perfil/editar']}>
        <EditProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  await screen.findByLabelText('Nombre de usuario')
  return utils
}

/**
 * WU10c — `/perfil/editar` PR2. `EditProfilePage` (container) reads
 * `useExplorerProfile()` (`GET /explorers/me`, genuine — no longer a
 * session-only echo, issue #40 retired) and renders one of 3 branches:
 * pending -> skeleton, error -> blocking retry UI (D5), success ->
 * `EditProfileForm` prefilled from the real read (spec "Edit Form
 * Prefills From Server-Read Profile Data").
 */
describe('EditProfilePage', () => {
  it('prefills the form from the real server read — username value and each returned interest pill aria-pressed', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(
          meResponse({ username: 'nachomed', interests: ['Naturaleza', 'Aventura'] })
        )
      )
    )
    await renderPage()

    expect(screen.getByLabelText('Nombre de usuario')).toHaveValue('nachomed')
    expect(screen.getByRole('button', { name: 'Naturaleza' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Aventura' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Arte' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('disables the username field and shows the exact remaining days when the read profile is within cooldown', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(
          meResponse({
            usernameChangedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          })
        )
      )
    )
    await renderPage()

    expect(screen.getByLabelText('Nombre de usuario')).toBeDisabled()
    expect(screen.getByText(/25 día/)).toBeInTheDocument()
  })

  it('renders exactly the 6 real interest options as toggleable pills', async () => {
    await renderPage()

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
    await renderPage()

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
    await renderPage()

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

  it('shows a preview via URL.createObjectURL when a valid file is chosen', async () => {
    await renderPage()

    const input = screen.getByLabelText('Cambiar foto de perfil')
    fireEvent.change(input, { target: { files: [makeFile('avatar.jpg', 1024)] } })

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:mock-preview')
  })

  it('blocks files over 5 MB client-side and shows an error, without staging the file', async () => {
    await renderPage()

    const input = screen.getByLabelText('Cambiar foto de perfil')
    fireEvent.change(input, { target: { files: [makeFile('big.jpg', 6 * 1024 * 1024)] } })

    expect(screen.getByText(/5 ?MB/i)).toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('choosing a file clears a pending "remove" selection', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(meResponse({ avatarUrl: 'https://cdn.example.com/avatars/a.jpg' }))
      )
    )
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /quitar foto/i }))
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cambiar foto de perfil'), {
      target: { files: [makeFile('avatar.jpg', 1024)] },
    })

    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument()
  })

  it('choosing "remove" clears a pending file selection', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(meResponse({ avatarUrl: 'https://cdn.example.com/avatars/a.jpg' }))
      )
    )
    await renderPage()

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
    await renderPage()

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
    await renderPage()

    const submit = screen.getByRole('button', { name: /guardar/i })
    fireEvent.click(submit)

    await waitFor(() => expect(submit).toBeDisabled())
  })
})

/**
 * PR8 (explorer-onboarding-settings, D7) — logout, `ThemeSwitcher`, and
 * `LanguageSwitcher` all relocated to `/configuracion` (`settings-page.tsx`).
 * Spec "Single Logout Surface" / "Theme Switcher Relocation": Editar Perfil
 * MUST NOT expose any of the three controls, on any of its 3 render
 * branches (pending / error / success). These assertions are non-vacuous —
 * before this PR's GREEN step, all three controls genuinely render here.
 */
describe('EditProfilePage — no logout, theme, or language controls', () => {
  it('renders no logout control on the success branch', async () => {
    await renderPage()

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('renders no logout control on the pending branch, before the profile read resolves', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, async () => {
        await delay('infinite')
        return HttpResponse.json(meResponse())
      })
    )

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil/editar']}>
          <EditProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('renders no logout control on the error branch, when GET /explorers/me fails', async () => {
    server.use(http.get(`${baseURL}/explorers/me`, () => new HttpResponse(null, { status: 500 })))

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil/editar']}>
          <EditProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('renders no theme switcher control', async () => {
    await renderPage()

    expect(screen.queryByRole('group', { name: 'Tema' })).not.toBeInTheDocument()
  })

  it('renders no language switcher control', async () => {
    await renderPage()

    expect(screen.queryByRole('group', { name: 'Idioma' })).not.toBeInTheDocument()
  })
})

/**
 * WU10c — spec "Pending state before data arrives" (`/perfil/editar`).
 * Mirrors `profile-page.dom.test.tsx`'s equivalent pending-state test: an
 * infinitely delayed `GET /explorers/me` response keeps `meQuery.isPending`
 * true, so `EditProfileForm` must never mount and only the container's
 * inline skeleton (D9) is present.
 */
describe('EditProfilePage pending state', () => {
  it('shows a loading skeleton before the initial GET /explorers/me resolves, with no form rendered yet', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, async () => {
        await delay('infinite')
        return HttpResponse.json(meResponse())
      })
    )

    const { container } = render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil/editar']}>
          <EditProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Nombre de usuario')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()
  })
})

/**
 * WU11 (i18n) PR4c — `gamification` namespace EN-switch coverage for
 * `/perfil/editar`. Mirrors `profile-view.dom.test.tsx`'s single
 * changeLanguage('en') + real-EN-string-assertions pattern. Covers the
 * form's static copy, the interest pills (now read from
 * `interests-catalog.ts`'s `labelKey` through `t()`, not the deprecated
 * static `label`), and the avatar actions — logout/confirmation copy moved
 * to `settings-page.tsx` (PR8, design D7) and is covered there.
 */
describe('EditProfilePage gamification EN-switch', () => {
  afterEach(async () => {
    await act(async () => {
      await i18next.changeLanguage('es')
    })
  })

  it('renders real English copy for form labels, interest pills, and avatar actions', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(
          meResponse({
            interests: ['Aventura'],
            avatarUrl: 'https://cdn.example.com/avatars/a.jpg',
          })
        )
      )
    )
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil/editar']}>
          <EditProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await screen.findByLabelText('Username')

    expect(screen.getByText('Profile photo')).toBeInTheDocument()
    expect(screen.getByLabelText('Change profile photo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument()
    expect(screen.getByText('Interests')).toBeInTheDocument()
    // Interest pill label resolved through interests-catalog.ts's labelKey,
    // not the deprecated static `label` field (removed in this PR).
    expect(screen.getByRole('button', { name: 'Adventure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('renders the translated network error message when a PATCH fails', async () => {
    server.use(
      http.patch(`${baseURL}/explorers/me`, () =>
        HttpResponse.json({ title: 'Something.Else' }, { status: 400 })
      )
    )
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil/editar']}>
          <EditProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await screen.findByLabelText('Username')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText("We couldn't save the changes. Try again in a few minutes.")
    ).toBeInTheDocument()
  })

  it('renders translated retry copy on the error-state branch', async () => {
    server.use(http.get(`${baseURL}/explorers/me`, () => new HttpResponse(null, { status: 500 })))
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil/editar']}>
          <EditProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText("We couldn't load your profile.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

/**
 * WU10c design decision D5 (LOCKED, user-accepted) — a failed
 * `GET /explorers/me` blocks the form entirely rather than failing open
 * into an unprefilled form: `onSubmit` unconditionally sends
 * `interests: selectedInterests`, and `[]` is a FULL REPLACE server-side,
 * so an unprefilled form is destructive, not merely incomplete.
 */
describe('EditProfilePage error state', () => {
  it('blocks the form and shows a retry affordance when GET /explorers/me fails, without ever firing the PATCH', async () => {
    server.use(http.get(`${baseURL}/explorers/me`, () => new HttpResponse(null, { status: 500 })))
    let patchCalls = 0
    server.use(
      http.patch(`${baseURL}/explorers/me`, () => {
        patchCalls += 1
        return HttpResponse.json(meResponse())
      })
    )

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/perfil/editar']}>
          <EditProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText('No pudimos cargar tu perfil.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre de usuario')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Naturaleza' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(patchCalls).toBe(0)
  })
})
