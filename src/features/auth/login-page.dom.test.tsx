import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import i18next from 'i18next'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { LoginPage } from './login-page'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  it('renders the real Spanish copy under the default language', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
    // Two "Crear cuenta" links exist (mobile + desktop footer variants, both
    // present in the DOM regardless of the CSS breakpoint that shows them).
    expect(screen.getAllByText('Crear cuenta')).toHaveLength(2)
  })

  /**
   * EN-switch regression test for the `auth` namespace (WU11 PR2), mirroring
   * `rail-nav.dom.test.tsx`'s pattern for the `common` namespace: proves the
   * page reads from `useTranslation('auth')` and re-renders with real English
   * strings, not just that the ES literals happen to still work.
   */
  it('renders the real English copy after switching language, proving the auth namespace is wired', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getAllByText('Create account')).toHaveLength(2)
  })
})
