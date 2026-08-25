import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveMapCenter } from '@/features/map/use-map-center'
import { requestPosition } from '@/features/checkin/media/request-position'
import { DEFAULT_CENTER } from '@/features/map/map-config'

/**
 * `resolveMapCenter` orchestrates `requestPosition()` (reused from
 * `features/checkin/media/`, design decision #6 — an accepted cross-feature
 * import, flagged for a future promotion to `shared/lib/geo/`) with a
 * `DEFAULT_CENTER` fallback so the map is never a dead screen. Implemented
 * as a plain async function rather than a stateful hook — it has no React
 * state of its own, so it's tested here without a DOM/render harness (a
 * consuming component owns the `useState`/`useEffect` wiring in PR1b).
 */
vi.mock('@/features/checkin/media/request-position')

describe('resolveMapCenter', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('resolves with the GPS reading and source:"gps" on success', async () => {
    vi.mocked(requestPosition).mockResolvedValue({
      latitude: 6.2234,
      longitude: -75.5802,
      gpsAccuracyMeters: 12.5,
    })

    await expect(resolveMapCenter()).resolves.toEqual({
      center: { lat: 6.2234, lng: -75.5802 },
      source: 'gps',
    })
  })

  it('resolves with DEFAULT_CENTER and source:"default" on GPS denial', async () => {
    vi.mocked(requestPosition).mockRejectedValue(new Error('permission denied'))

    await expect(resolveMapCenter()).resolves.toEqual({
      center: DEFAULT_CENTER,
      source: 'default',
    })
  })

  it('resolves with DEFAULT_CENTER and source:"default" on GPS timeout, never hanging', async () => {
    vi.mocked(requestPosition).mockRejectedValue(new Error('timeout'))

    await expect(resolveMapCenter()).resolves.toEqual({
      center: DEFAULT_CENTER,
      source: 'default',
    })
  })
})
