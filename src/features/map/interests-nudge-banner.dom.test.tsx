import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http, delay } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { InterestsNudgeBanner } from './interests-nudge-banner'
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

function renderBanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <InterestsNudgeBanner />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/**
 * explorer-onboarding-settings PR5 — design D8 (PO-confirmed). Soft,
 * dismissible nudge on the map for an authenticated explorer with zero
 * interests. Reads the same `GET /explorers/me` query `/perfil/editar`
 * already uses (TanStack dedupes on the shared key), never blocks
 * navigation, and dismiss is per-session (component state, not persisted).
 */
describe('InterestsNudgeBanner', () => {
  it('renders nothing while the profile read is pending', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, async () => {
        await delay('infinite')
        return HttpResponse.json(meResponse())
      })
    )
    renderBanner()

    expect(screen.queryByTestId('interests-nudge-banner')).not.toBeInTheDocument()
  })

  it('shows the nudge with a link to /perfil/editar when the explorer has zero interests', async () => {
    server.use(http.get(`${baseURL}/explorers/me`, () => HttpResponse.json(meResponse())))
    renderBanner()

    expect(await screen.findByTestId('interests-nudge-banner')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /elegir intereses/i })).toHaveAttribute(
      'href',
      '/perfil/editar'
    )
  })

  it('renders nothing when the explorer already has interests', async () => {
    server.use(
      http.get(`${baseURL}/explorers/me`, () =>
        HttpResponse.json(meResponse({ interests: ['Aventura'] }))
      )
    )
    renderBanner()

    await waitFor(() =>
      expect(screen.queryByTestId('interests-nudge-banner')).not.toBeInTheDocument()
    )
  })

  it('dismisses on click and stays hidden', async () => {
    server.use(http.get(`${baseURL}/explorers/me`, () => HttpResponse.json(meResponse())))
    renderBanner()

    await screen.findByTestId('interests-nudge-banner')
    fireEvent.click(screen.getByRole('button', { name: /cerrar aviso/i }))

    expect(screen.queryByTestId('interests-nudge-banner')).not.toBeInTheDocument()
  })
})
