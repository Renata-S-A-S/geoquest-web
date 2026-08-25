import { requestPosition } from '@/features/checkin/media/request-position'
import { DEFAULT_CENTER, type Coordinates } from '@/features/map/map-config'

/**
 * WU003b (map discovery) — center resolution for the map (design decision
 * #6). Reuses `requestPosition()` from `features/checkin/media/` (an
 * accepted cross-feature import for this slice; a future promotion to
 * `shared/lib/geo/` is deliberately out of this slice's diff budget). On
 * GPS denial or timeout, falls back to `DEFAULT_CENTER` and still lets the
 * caller fetch nearby places — never a dead screen.
 *
 * A plain async function, not a stateful hook: it owns no React state of
 * its own. `map-page.tsx` (PR1b) wires the `useState`/`useEffect` around
 * this call.
 */

export type MapCenterSource = 'gps' | 'default'

export interface MapCenterResult {
  center: Coordinates
  source: MapCenterSource
}

export async function resolveMapCenter(): Promise<MapCenterResult> {
  try {
    const reading = await requestPosition()
    return {
      center: { lat: reading.latitude, lng: reading.longitude },
      source: 'gps',
    }
  } catch {
    return { center: DEFAULT_CENTER, source: 'default' }
  }
}
