import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { ResetPasswordPage } from './reset-password-page'

const baseURL = 'http://localhost:5219'

function renderPage(search = '?email=user%40example.com&token=abc123') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
    target: { value: 'password123' },
  })
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {
    target: { value: 'password123' },
  })
}

describe('ResetPasswordPage', () => {
  it('renders the real Spanish copy and the form when email/token are present in the query string', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Restablecer contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restablecer contraseña' })).toBeInTheDocument()
  })

  /**
   * The reset link is built by the backend as
   * `{FrontendBaseUrl}{ResetPath}?email={email}&token={token}` — a missing
   * email or token means a broken/incomplete link, and the page must show an
   * error state instead of attempting the request.
   */
  it('shows the invalid-link error state and never renders the form when token is missing', () => {
    renderPage('?email=user%40example.com')

    expect(screen.getByText('Enlace inválido')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })

  it('shows the invalid-link error state and never renders the form when email is missing', () => {
    renderPage('?token=abc123')

    expect(screen.getByText('Enlace inválido')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })

  it('shows the invalid-link error state when both email and token are missing', () => {
    renderPage('')

    expect(screen.getByText('Enlace inválido')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })

  it('submits email/token from the query string plus the new password, and shows confirmation on success', async () => {
    let receivedBody: unknown
    server.use(
      http.post(`${baseURL}/auth/password/reset`, async ({ request }) => {
        receivedBody = await request.json()
        return new HttpResponse(null, { status: 200 })
      })
    )
    renderPage()

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }))

    expect(
      await screen.findByText('Tu contraseña fue actualizada. Ya podés iniciar sesión.')
    ).toBeInTheDocument()
    expect(receivedBody).toEqual({
      email: 'user@example.com',
      token: 'abc123',
      newPassword: 'password123',
    })
    await waitFor(() => expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument())
  })

  it('shows the mapped invalid/expired token error on a 401 response and keeps the form visible', async () => {
    server.use(
      http.post(
        `${baseURL}/auth/password/reset`,
        () =>
          new HttpResponse(JSON.stringify({ title: 'Identity.InvalidResetToken' }), {
            status: 401,
          })
      )
    )
    renderPage()

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }))

    expect(
      await screen.findByText('Este enlace ya no es válido o expiró. Solicitá uno nuevo.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
  })

  it('blocks submission with an inline error when the passwords do not match', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {
      target: { value: 'different123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }))

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
  })
})
