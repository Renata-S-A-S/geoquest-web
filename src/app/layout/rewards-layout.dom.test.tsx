import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RewardsLayout } from './rewards-layout'

/**
 * `/premios` section chrome. The children are STUBS on purpose: this suite
 * proves the sub-nav and the `<Outlet/>` swap, not what either screen
 * renders, and stubbing keeps `LeaderboardPage` (and its query/network
 * surface) entirely out of this tree. Building a local `MemoryRouter` with
 * an explicit route table follows `terms-page.dom.test.tsx` and
 * `protected-route.dom.test.tsx`.
 */
function renderLayout(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/premios" element={<RewardsLayout />}>
          <Route index element={<div>catalog-stub</div>} />
          <Route path="leaderboard" element={<div>ranking-stub</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('RewardsLayout', () => {
  it('renders a sub-nav with a link to the catalog and a link to the ranking', () => {
    renderLayout('/premios')

    const subnav = screen.getByTestId('rewards-subnav')
    expect(within(subnav).getByRole('link', { name: 'Catálogo' })).toHaveAttribute(
      'href',
      '/premios'
    )
    expect(within(subnav).getByRole('link', { name: 'Ranking' })).toHaveAttribute(
      'href',
      '/premios/leaderboard'
    )
  })

  it('renders the catalog child at the section root', () => {
    renderLayout('/premios')

    expect(screen.getByText('catalog-stub')).toBeInTheDocument()
    expect(screen.queryByText('ranking-stub')).not.toBeInTheDocument()
  })

  it('swaps the Outlet to the ranking child at /premios/leaderboard', () => {
    renderLayout('/premios/leaderboard')

    expect(screen.getByText('ranking-stub')).toBeInTheDocument()
    expect(screen.queryByText('catalog-stub')).not.toBeInTheDocument()
  })

  it('marks only the catalog link as current at the section root', () => {
    renderLayout('/premios')

    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Ranking' })).not.toHaveAttribute('aria-current')
  })

  /**
   * The regression this pins: without `end` on the catalog link, `/premios`
   * is a prefix of `/premios/leaderboard` and BOTH links would read as
   * current on the ranking URL.
   */
  it('marks only the ranking link as current at /premios/leaderboard', () => {
    renderLayout('/premios/leaderboard')

    expect(screen.getByRole('link', { name: 'Ranking' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Catálogo' })).not.toHaveAttribute('aria-current')
  })
})
