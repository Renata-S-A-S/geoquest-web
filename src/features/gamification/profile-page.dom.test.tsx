import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http, delay } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { ProfilePage } from './profile-page'

const baseURL = 'http://localhost:5219'

const gamingProfileResponse = {
  explorerId: 'explorer-1',
  totalXP: 820,
  weeklyXP: 120,
  geoPointsBalance: 40,
  currentLevel: 'Traveler',
  currentStreak: 3,
  longestStreak: 8,
  lastActivityLocalDate: '2026-08-24',
  badges: [],
}

const explorerMeResponse = {
  explorerId: 'explorer-1',
  username: 'nachomed',
  avatarUrl: null,
  interests: [],
  usernameChangedAt: null,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/perfil']}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

/**
 * WU10c — `/perfil` container test. `useProfile()` (`GET /gaming/profile`)
 * and `useExplorerProfile()` (`GET /explorers/me`) compose in parallel;
 * `GET /gaming/leaderboard` MUST NOT be requested by this screen (spec
 * "Profile View Data Assembly"). Identity failure stays degraded, not
 * fatal (design decision D2) — `me` only supplies 2 of 10
 * `AssembledProfile` fields.
 */
describe('ProfilePage', () => {
  it('shows a loading skeleton while either query is pending', async () => {
    server.use(
      http.get(`${baseURL}/gaming/profile`, async () => {
        await delay('infinite')
        return HttpResponse.json(gamingProfileResponse)
      }),
      http.get(`${baseURL}/explorers/me`, async () => {
        await delay('infinite')
        return HttpResponse.json(explorerMeResponse)
      })
    )

    const { container } = renderPage()

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('No pudimos cargar tu perfil.')).not.toBeInTheDocument()
  })

  it('shows a fatal full-page error when GET /gaming/profile fails', async () => {
    server.use(
      http.get(`${baseURL}/gaming/profile`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${baseURL}/explorers/me`, () => HttpResponse.json(explorerMeResponse))
    )

    renderPage()

    expect(await screen.findByText('No pudimos cargar tu perfil.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('nachomed')).not.toBeInTheDocument()
  })

  it('degrades only the identity section when GET /explorers/me fails — progress still renders', async () => {
    server.use(
      http.get(`${baseURL}/gaming/profile`, () => HttpResponse.json(gamingProfileResponse)),
      http.get(`${baseURL}/explorers/me`, () => new HttpResponse(null, { status: 500 }))
    )

    renderPage()

    expect(await screen.findByText('No pudimos cargar tu identidad.')).toBeInTheDocument()
    // currentLevel: 'Traveler' -> gamification.json levels.Traveler under es
    expect(screen.getByText('Viajero')).toBeInTheDocument()
    expect(screen.getByText('3 días de racha')).toBeInTheDocument()
  })

  it('renders identity and progress together on success, issuing zero requests to /gaming/leaderboard', async () => {
    let leaderboardCalls = 0
    server.use(
      http.get(`${baseURL}/gaming/profile`, () => HttpResponse.json(gamingProfileResponse)),
      http.get(`${baseURL}/explorers/me`, () => HttpResponse.json(explorerMeResponse)),
      http.get(`${baseURL}/gaming/leaderboard`, () => {
        leaderboardCalls += 1
        return HttpResponse.json({ weekStartUtc: '2026-08-17T00:00:00Z', top: [], me: null })
      })
    )

    renderPage()

    expect(await screen.findByText('nachomed')).toBeInTheDocument()
    expect(screen.getByText('Viajero')).toBeInTheDocument()
    await waitFor(() => expect(leaderboardCalls).toBe(0))
  })
})
