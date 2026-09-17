import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { RewardsPage } from '@/features/rewards/rewards-page'
import type { RewardSummaryResult } from '@/features/rewards/schemas'

/**
 * `/premios` (index) — the published reward catalog. The list is real
 * network data (`GET /rewards`, `RewardSummaryResult`), mocked via msw here.
 * Fixtures are local to this file and shaped exactly as the flat array the
 * endpoint returns: all seven contract fields, with `menuItemId` covered in
 * both its `Guid` and its `null` form.
 */
const baseURL = TEST_API_BASE_URL

const rewardA: RewardSummaryResult = {
  rewardId: 'b8f4d3c2-1a05-4e77-9c31-6d2f8e4a7b10',
  businessId: '3c1e9a77-5b42-4f08-b6d9-08a1c2e5f734',
  title: 'Café de la casa gratis',
  description: 'Un café filtrado de cortesía en tu próxima visita.',
  geoPointsCost: 500,
  estimatedValueCop: 8000,
  menuItemId: 'f27a4b61-9d3c-4e15-8a02-7c6b5d1e9034',
}

const rewardB: RewardSummaryResult = {
  rewardId: '5d9c2e18-7b34-4a60-91f8-2e0d7a3c6b45',
  businessId: '9a0b7c6d-4e31-4852-bf27-1d3e8c5a0f92',
  title: 'Postre de cortesía',
  description: 'Elegí cualquier postre de la carta sin costo.',
  geoPointsCost: 1200,
  estimatedValueCop: 25000,
  menuItemId: null,
}

/**
 * ICU hazard (same one `format-cop.test.ts` documents): `es-CO` + `COP`
 * separates symbol and digits with a non-breaking space whose code point
 * varies by ICU build, and the symbol itself is not stable across Node
 * versions. Assertions strip every space variant instead of pinning a
 * literal like `'$ 25.000'`.
 */
function withoutWhitespace(value: string): string {
  return value.replace(/[\s\u00A0\u202F]/g, '')
}

function mockRewardsList(rewards: RewardSummaryResult[]) {
  server.use(http.get(`${baseURL}/rewards`, () => HttpResponse.json(rewards)))
}

function renderRewardsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RewardsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RewardsPage', () => {
  it('renders one card per published reward with title, description, GeoPoints cost and COP value', async () => {
    mockRewardsList([rewardA, rewardB])
    renderRewardsPage()

    const cardA = await screen.findByTestId(`reward-card-${rewardA.rewardId}`)
    expect(within(cardA).getByText(rewardA.title)).toBeInTheDocument()
    expect(within(cardA).getByText(rewardA.description)).toBeInTheDocument()
    expect(within(cardA).getByText(`${rewardA.geoPointsCost} pts`)).toBeInTheDocument()
    expect(withoutWhitespace(cardA.textContent ?? '')).toContain('Valoraprox.')
    expect(withoutWhitespace(cardA.textContent ?? '')).toContain('8.000')

    const cardB = screen.getByTestId(`reward-card-${rewardB.rewardId}`)
    expect(within(cardB).getByText(rewardB.title)).toBeInTheDocument()
    expect(within(cardB).getByText(rewardB.description)).toBeInTheDocument()
    expect(within(cardB).getByText(`${rewardB.geoPointsCost} pts`)).toBeInTheDocument()
    expect(withoutWhitespace(cardB.textContent ?? '')).toContain('25.000')

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  /**
   * `RewardSummaryResult` carries no image field (see `schemas.ts`), so a
   * card must not invent one — no placeholder art, no decorative photo.
   */
  it('exposes no image on any card, because the contract carries no image field', async () => {
    mockRewardsList([rewardA, rewardB])
    renderRewardsPage()

    const cardA = await screen.findByTestId(`reward-card-${rewardA.rewardId}`)
    expect(within(cardA).queryAllByRole('img')).toHaveLength(0)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('shows the loading skeleton while GET /rewards is in flight [Loading state]', () => {
    mockRewardsList([rewardA, rewardB])
    renderRewardsPage()

    expect(screen.getByTestId('rewards-list-loading')).toBeInTheDocument()
  })

  it('shows an empty state when the catalog has no published rewards', async () => {
    mockRewardsList([])
    renderRewardsPage()

    expect(await screen.findByText('Todavía no hay premios')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('shows an inline error and refetches the catalog when the retry button is pressed', async () => {
    let attempts = 0
    server.use(
      http.get(`${baseURL}/rewards`, () => {
        attempts += 1
        return attempts === 1 ? HttpResponse.error() : HttpResponse.json([rewardA])
      })
    )
    renderRewardsPage()

    expect(await screen.findByText('No pudimos cargar los premios.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText(rewardA.title)).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})
