import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useSettingsStore } from '@/shared/stores/settings-store'
import { SettingsPage } from './settings-page'

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
