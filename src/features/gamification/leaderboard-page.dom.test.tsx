import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { LeaderboardPage } from './leaderboard-page'

const baseURL = 'http://localhost:5219'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LeaderboardPage />
    </QueryClientProvider>
  )
}

function entry(overrides: Record<string, unknown>) {
  return {
    rank: 1,
    explorerId: 'x',
    username: 'user',
    avatarUrl: null,
    weeklyXP: 0,
    ...overrides,
  }
}

/**
 * WU10 (gamification) PR6 — spec "Weekly Ranked List Rendering" +
 * "Own Rank Highlighted Even Outside Visible List".
 */
describe('LeaderboardPage', () => {
  it('renders tied ranks (1,1,1,4) in order', async () => {
    server.use(
      http.get(`${baseURL}/gaming/leaderboard`, () =>
        HttpResponse.json({
          weekStartUtc: '2026-08-24T00:00:00Z',
          top: [
            entry({ explorerId: 'a', rank: 1, username: 'ana' }),
            entry({ explorerId: 'b', rank: 1, username: 'beto' }),
            entry({ explorerId: 'c', rank: 1, username: 'caro' }),
            entry({ explorerId: 'd', rank: 4, username: 'dana' }),
          ],
          me: null,
        })
      )
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('ana')).toBeInTheDocument())
    const ranks = screen.getAllByText(/^#\d/).map((el) => el.textContent)
    expect(ranks).toEqual(['#1', '#1', '#1', '#4'])
  })

  it('highlights own row in place when me is inside top', async () => {
    server.use(
      http.get(`${baseURL}/gaming/leaderboard`, () =>
        HttpResponse.json({
          weekStartUtc: '2026-08-24T00:00:00Z',
          top: [
            entry({ explorerId: 'a', rank: 1, username: 'ana' }),
            entry({ explorerId: 'me-1', rank: 2, username: 'yo' }),
          ],
          me: entry({ explorerId: 'me-1', rank: 2, username: 'yo' }),
        })
      )
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('yo')).toBeInTheDocument())
    expect(screen.getAllByText('yo')).toHaveLength(1)
    expect(screen.getByTestId('leaderboard-row-me-1')).toHaveAttribute('data-me', 'true')
  })

  it('shows a pinned row for me when outside the visible top list', async () => {
    server.use(
      http.get(`${baseURL}/gaming/leaderboard`, () =>
        HttpResponse.json({
          weekStartUtc: '2026-08-24T00:00:00Z',
          top: [entry({ explorerId: 'a', rank: 1, username: 'ana' })],
          me: entry({ explorerId: 'me-1', rank: 47, username: 'yo', weeklyXP: 10 }),
        })
      )
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('yo')).toBeInTheDocument())
    expect(screen.getByTestId('leaderboard-pinned-row')).toBeInTheDocument()
    expect(screen.getByText('#47')).toBeInTheDocument()
  })

  it('shows an empty state when top is empty and there is no me', async () => {
    server.use(
      http.get(`${baseURL}/gaming/leaderboard`, () =>
        HttpResponse.json({ weekStartUtc: '2026-08-24T00:00:00Z', top: [], me: null })
      )
    )

    renderPage()

    await waitFor(() => expect(screen.getByText(/todav[ií]a no hay/i)).toBeInTheDocument())
  })
})
