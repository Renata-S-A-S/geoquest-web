import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from './nav-items'

describe('NAV_ITEMS', () => {
  it('points the Premios item at the leaderboard screen, not the placeholder route', () => {
    const premios = NAV_ITEMS.find((item) => item.label === 'Premios')

    expect(premios?.to).toBe('/premios/leaderboard')
  })
})
