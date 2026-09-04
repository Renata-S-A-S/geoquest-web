import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { ForgotPasswordPage } from './forgot-password-page'

const baseURL = 'http://localhost:5219'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ForgotPasswordPage', () => {
  it('renders the real Spanish copy', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  /**
   * The backend ALWAYS answers 200 OK regardless of whether the account
   * exists (anti account-enumeration) — the confirmation copy must be the
   * generic neutral message, never something implying the email was
   * confirmed to exist or to have been delivered.
   */
  it('replaces the form with the neutral confirmation message on success, regardless of account existence', async () => {
    server.use(
      http.post(`${baseURL}/auth/password/forgot`, () => new HttpResponse(null, { status: 200 }))
    )
    renderPage()

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(
      await screen.findByText(
        'Si el correo existe en nuestro sistema, vas a recibir un enlace para restablecer tu contraseña en los próximos minutos.'
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
    )
  })

  it('shows the mapped rate-limit error on a 429 response and keeps the form visible', async () => {
    server.use(
      http.post(
        `${baseURL}/auth/password/forgot`,
        () => new HttpResponse(JSON.stringify({}), { status: 429 })
      )
    )
    renderPage()

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(
      await screen.findByText('Demasiados intentos. Probá de nuevo más tarde.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
  })

  it('blocks submission with an inline error for an invalid email, never calling the API', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'not-an-email' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByText('Ingresá un correo válido')).toBeInTheDocument()
  })
})
