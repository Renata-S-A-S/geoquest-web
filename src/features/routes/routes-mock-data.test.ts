import { describe, expect, it } from 'vitest'
import { routeSchema } from '@/features/routes/schemas'
import { MOCK_ROUTES } from '@/features/routes/routes-mock-data'

/**
 * Guards `routes-mock-data.ts` against drifting away from the real backend
 * contract (`routeSchema`) — every mock route must stay a valid `Route`,
 * and `stops` must stay in sync with `placeIds` (same ids, same order).
 */
describe('MOCK_ROUTES', () => {
  it('has at least one seeded route', () => {
    expect(MOCK_ROUTES.length).toBeGreaterThan(0)
  })

  it.each(MOCK_ROUTES)('$name matches the real Route contract', (route) => {
    expect(() => routeSchema.parse(route)).not.toThrow()
    expect(route.status).toBe('Published')
  })

  it.each(MOCK_ROUTES)('$name has one stop per placeId, in the same order', (route) => {
    expect(route.stops.map((stop) => stop.placeId)).toEqual(route.placeIds)
  })
})
