import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useOnboardingStore } from '@/shared/stores/onboarding-store'
import { ProtectedRoute } from './protected-route'

/**
 * explorer-onboarding-settings PR4 — design decision D1: `ProtectedRoute`
 * itself owns the "unauthenticated → where?" branch, now split in two by the
 * `onboarding-store` first-run flag, instead of always going to `/login`.
 */
function renderProtected(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/onboarding" element={<div>onboarding-route</div>} />
        <Route path="/login" element={<div>login-route</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>protected-route</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAtUtc: null,
      refreshTokenExpiresAtUtc: null,
    })
    useOnboardingStore.setState({ hasCompletedOnboarding: false })
  })

  it('redirects an unauthenticated first-run visitor (no onboarding flag) to /onboarding (D1)', () => {
    renderProtected('/')

    expect(screen.getByText('onboarding-route')).toBeInTheDocument()
  })

  it('redirects an unauthenticated returning visitor (onboarding flag set) to /login (D1)', () => {
    useOnboardingStore.setState({ hasCompletedOnboarding: true })

    renderProtected('/')

    expect(screen.getByText('login-route')).toBeInTheDocument()
  })

  it('renders the protected outlet when authenticated, regardless of the onboarding flag', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
      refreshTokenExpiresAtUtc: '2099-01-02T00:00:00Z',
    })

    renderProtected('/')

    expect(screen.getByText('protected-route')).toBeInTheDocument()
  })
})
