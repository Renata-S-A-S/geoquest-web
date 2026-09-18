import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useSettingsStore } from '@/shared/stores/settings-store'
import { SettingsPage } from './settings-page'

// Account deletion must NOT navigate — `ProtectedRoute` already unmounts the
// tree when `isAuthenticated` flips, exactly like logout. `SettingsPage` never
// calls `useNavigate`, so this mock is inert for every block above and only
// gives the deletion block something to assert against.
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateSpy }
})

/**
 * explorer-onboarding-settings PR7 — full assembly (design D5/D6/D7, tasks
 * Phase 7). PR6's scaffold test only exercised `LanguageSwitcher`; PR7
 * mounts `ThemeSwitcher` (now available — the `feat/frontend-theme-system`
 * branch merged onto this branch, resolving PR6's blocking risk), the
 * notification/privacy toggles wired to `settings-store.ts` (PR6), a T&C
 * link, and logout — mirroring `edit-profile-page.tsx`'s existing
 * `ConfirmationModal` + `queryClient.clear()` pattern exactly, since PR8
 * will remove logout from there.
 */
function renderPage(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/configuracion']}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SettingsPage (PR6 scaffold)', () => {
  it('renders the Configuración title', () => {
    renderPage()

    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('mounts LanguageSwitcher — both endonym buttons are reachable', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
  })
})

describe('SettingsPage theme switcher (PR7)', () => {
  it('mounts ThemeSwitcher on Configuración', () => {
    renderPage()

    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument()
  })
})

describe('SettingsPage preferences (PR7, D6)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ notificationsEnabled: true, privacyAnalytics: true })
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders the notifications toggle reflecting the store default (on)', () => {
    renderPage()

    expect(screen.getByRole('switch', { name: 'Activar notificaciones' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  it('toggling notifications off calls settings-store setNotificationsEnabled and flips the switch', () => {
    renderPage()

    fireEvent.click(screen.getByRole('switch', { name: 'Activar notificaciones' }))

    expect(useSettingsStore.getState().notificationsEnabled).toBe(false)
    expect(screen.getByRole('switch', { name: 'Activar notificaciones' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('toggling privacy off calls settings-store setPrivacyAnalytics and leaves notifications untouched', () => {
    renderPage()

    fireEvent.click(screen.getByRole('switch', { name: 'Compartir datos de uso' }))

    expect(useSettingsStore.getState().privacyAnalytics).toBe(false)
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true)
    expect(screen.getByRole('switch', { name: 'Compartir datos de uso' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })
})

describe('SettingsPage T&C link', () => {
  it('renders a Términos y condiciones link to /terminos', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute(
      'href',
      '/terminos'
    )
  })
})

/**
 * Mirrors `edit-profile-page.dom.test.tsx`'s `EditProfilePage logout`
 * describe block exactly (same accessible-name-collision disambiguation:
 * the trigger button and the `ConfirmationModal` confirm button share the
 * name "Cerrar sesión").
 */
describe('SettingsPage logout (PR7, mirrors edit-profile-page)', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, accessToken: 'token' })
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('opens a confirmation modal with the exact logout copy when "Cerrar sesión" is activated', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(screen.getByText('¿Cerrar sesión?')).toBeInTheDocument()
    expect(screen.getByText('Vas a necesitar iniciar sesión de nuevo.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Cerrar sesión' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('closes the modal on Cancel, keeps the session active, and never calls logout()', () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout')
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByText('¿Cerrar sesión?')).not.toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(logoutSpy).not.toHaveBeenCalled()
  })

  it('calls logout() and clears the QueryClient cache on Confirm', () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['explorer', 'me'], { username: 'nachomed' })
    renderPage(queryClient)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    const confirmButtons = screen.getAllByRole('button', { name: 'Cerrar sesión' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(logoutSpy).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(queryClient.getQueryData(['explorer', 'me'])).toBeUndefined()
  })
})

/**
 * Account deletion (issue #110, Ley 1581 habeas data). `DELETE /explorers/me`
 * answers 204 on success AND 204 when the explorer is already
 * `PendingDeletion`. Because `ExplorerErasureOptions.ErasureEnabled` defaults
 * to false, the copy promises deactivation and reactivation on the next login
 * — never erasure, and never a date. The grace-window explanation is asserted
 * in the modal description, before confirming: `ProtectedRoute` unmounts this
 * tree the instant `isAuthenticated` flips, so any post-success message would
 * die with it.
 */
describe('SettingsPage account deletion (issue #110)', () => {
  const deleteAccountUrl = `${TEST_API_BASE_URL}/explorers/me`

  beforeEach(() => {
    navigateSpy.mockClear()
    useAuthStore.setState({ isAuthenticated: true, accessToken: 'token' })
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  function spyOnLogout() {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout')
    logoutSpy.mockClear()
    return logoutSpy
  }

  function openDeletionModal() {
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
  }

  /** Same accessible-name-collision disambiguation as the logout block above. */
  function confirmDeletion() {
    const confirmButtons = screen.getAllByRole('button', { name: 'Eliminar mi cuenta' })
    fireEvent.click(confirmButtons[confirmButtons.length - 1])
  }

  it('renders the deletion section heading, its explanatory paragraph and its button', () => {
    renderPage()

    expect(screen.getByText('Eliminar cuenta')).toBeInTheDocument()
    expect(
      screen.getByText('Al eliminar tu cuenta dejarás de acceder a GeoQuest con ella.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar mi cuenta' })).toBeInTheDocument()
  })

  it('explains deactivation and reactivation in the modal description BEFORE confirming', () => {
    const logoutSpy = spyOnLogout()
    renderPage()

    openDeletionModal()

    expect(screen.getByText('¿Eliminar tu cuenta?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Tu cuenta quedará desactivada y cerraremos tu sesión. Si volvés a iniciar sesión con las mismas credenciales, tu cuenta se reactiva.'
      )
    ).toBeInTheDocument()
    expect(logoutSpy).not.toHaveBeenCalled()
  })

  it('calls logout() and clears the QueryClient cache on a 204, and never navigates', async () => {
    server.use(http.delete(deleteAccountUrl, () => new HttpResponse(null, { status: 204 })))
    const logoutSpy = spyOnLogout()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    queryClient.setQueryData(['explorer', 'me'], { username: 'nachomed' })
    renderPage(queryClient)

    openDeletionModal()
    confirmDeletion()

    await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(queryClient.getQueryData(['explorer', 'me'])).toBeUndefined()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('renders no cancel-deletion affordance anywhere — cancellation is implicit on the next successful login', () => {
    const cancelDeletion = /cancelar (la )?eliminaci/i
    renderPage()

    expect(screen.queryByText(cancelDeletion)).not.toBeInTheDocument()

    openDeletionModal()

    expect(screen.queryByText(cancelDeletion)).not.toBeInTheDocument()
    // The modal keeps its own generic cancel button; that is not a
    // "cancel the deletion request" affordance.
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('keeps the session and surfaces an inline error when the request fails', async () => {
    server.use(
      http.delete(deleteAccountUrl, () =>
        HttpResponse.json({ title: 'Explorer.AlreadyDeleted' }, { status: 409 })
      )
    )
    const logoutSpy = spyOnLogout()
    renderPage(
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      })
    )

    openDeletionModal()
    confirmDeletion()

    expect(
      await screen.findByText('No pudimos desactivar tu cuenta. Volvé a intentarlo.')
    ).toBeInTheDocument()
    expect(logoutSpy).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
