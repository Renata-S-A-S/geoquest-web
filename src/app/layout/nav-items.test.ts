import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from './nav-items'

describe('NAV_ITEMS', () => {
  it('points the rewards item at the leaderboard screen, not the placeholder route', () => {
    const rewards = NAV_ITEMS.find((item) => item.id === 'rewards')

    expect(rewards?.to).toBe('/premios/leaderboard')
  })

  it('gives every item a stable, non-translated id distinct from its labelKey', () => {
    const ids = NAV_ITEMS.map((item) => item.id)

    expect(ids).toEqual(['map', 'routes', 'rewards', 'profile'])
    expect(NAV_ITEMS.every((item) => item.labelKey.startsWith('nav.'))).toBe(true)
  })
})
