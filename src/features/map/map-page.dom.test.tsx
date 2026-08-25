import type { MouseEvent, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { DEFAULT_CENTER } from '@/features/map/map-config'
import { resolveMapCenter } from '@/features/map/use-map-center'
import { MapPage } from './map-page'

/**
 * WU003b (map discovery) PR1b — task 2.6, extended in PR2 — task 3.3.
 * `MapPage` is the container: `resolveMapCenter()` + `useNearbyPlaces` +
 * selection state, rendering `PlaceListPanel` + (`MapView` | `MapUnavailable`).
 * The original PR1b scenarios (no `VITE_MAPBOX_TOKEN` set anywhere in this
 * repo/test env) keep `hasMapboxToken` false and are unchanged below. PR2
 * adds a token-present group that overrides `hasMapboxToken` via the
 * `configState` toggle and mocks `react-map-gl` (jsdom cannot render WebGL,
 * per the design's testing-strategy table) to prove the pin<->list
 * selection sync and the `onError` -> `MapUnavailable` fallback.
 */

vi.mock('@/features/map/use-map-center', () => ({ resolveMapCenter: vi.fn() }))

const configState = { hasMapboxToken: false }
vi.mock('@/features/map/map-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/map/map-config')>()
  return {
    ...actual,
    get hasMapboxToken() {
      return configState.hasMapboxToken
    },
  }
})

vi.mock('react-map-gl', () => ({
  Map: ({
    children,
    onError,
  }: {
    children?: ReactNode
    onError?: (event: { error: Error }) => void
  }) => (
    <div data-testid="map">
      {children}
      <button
        type="button"
        data-testid="map-error-trigger"
        onClick={() => onError?.({ error: new Error('boom') })}
      />
    </div>
  ),
  Marker: ({
    children,
    onClick,
  }: {
    children?: ReactNode
    onClick?: (event: { originalEvent: MouseEvent }) => void
  }) => (
    <button type="button" onClick={(event) => onClick?.({ originalEvent: event })}>
      {children}
    </button>
  ),
  NavigationControl: () => null,
}))

const baseURL = 'http://localhost:5219'

function nearbyPlace(overrides: Record<string, unknown> = {}) {
  return {
    placeId: '1',
    name: 'El Cielo',
    description: 'Mirador panorámico',
    category: 4,
    subcategory: 17,
    latitude: DEFAULT_CENTER.lat,
    longitude: DEFAULT_CENTER.lng,
    distanceMeters: 850,
    pointsReward: 50,
    ...overrides,
  }
}

function renderMapPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/checkin" element={<div data-testid="checkin-stub" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => {
  useCheckinStore.setState({ selectedPlace: null })
  configState.hasMapboxToken = false
})

describe('MapPage', () => {
  it('shows a loading state, then the fetched list', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    expect(screen.queryByText('El Cielo')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('El Cielo')).toBeInTheDocument())
  })

  it('shows a load-error message and retries the query on demand', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    let calls = 0
    server.use(
      http.get(`${baseURL}/places/nearby`, () => {
        calls += 1
        if (calls === 1) return new HttpResponse(null, { status: 500 })
        return HttpResponse.json([nearbyPlace()])
      })
    )

    renderMapPage()

    await waitFor(() =>
      expect(screen.getByText('No pudimos cargar los lugares cercanos.')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => expect(screen.getByText('El Cielo')).toBeInTheDocument())
  })

  it('shows the empty state when there are no nearby places', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([])))

    renderMapPage()

    await waitFor(() => expect(screen.getByText('No hay lugares cerca')).toBeInTheDocument())
  })

  it('falls back to DEFAULT_CENTER and still fetches when GPS is denied', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({ center: DEFAULT_CENTER, source: 'default' })
    let capturedUrl: URL | undefined
    server.use(
      http.get(`${baseURL}/places/nearby`, ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json([nearbyPlace()])
      })
    )

    renderMapPage()

    await waitFor(() =>
      expect(
        screen.getByText('Mostrando lugares cerca de una ubicación predeterminada.')
      ).toBeInTheDocument()
    )
    await waitFor(() => expect(screen.getByText('El Cielo')).toBeInTheDocument())
    expect(capturedUrl?.searchParams.get('lat')).toBe(String(DEFAULT_CENTER.lat))
    expect(capturedUrl?.searchParams.get('lng')).toBe(String(DEFAULT_CENTER.lng))
  })

  it('filters the rendered list as the user types in the search box', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([
          nearbyPlace({ placeId: '1', name: 'El Cielo' }),
          nearbyPlace({ placeId: '2', name: 'Parque Arví' }),
        ])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByText('El Cielo')).toBeInTheDocument())

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'arvi' } })

    expect(screen.queryByText('El Cielo')).not.toBeInTheDocument()
    expect(screen.getByText('Parque Arví')).toBeInTheDocument()
  })

  it('selecting a place stores it and navigates to /checkin', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([nearbyPlace({ placeId: '42', name: 'El Cielo' })])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByText('El Cielo')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /el cielo/i }))

    await waitFor(() => expect(screen.getByTestId('checkin-stub')).toBeInTheDocument())
    expect(useCheckinStore.getState().selectedPlace).toEqual({
      placeId: '42',
      placeName: 'El Cielo',
    })
  })

  it('renders MapUnavailable with the missing-token reason while the list stays usable', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    const unavailable = await screen.findByTestId('map-unavailable')
    expect(unavailable).toHaveAttribute('data-reason', 'missingToken')

    await waitFor(() => expect(screen.getByText('El Cielo')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /el cielo/i }))
    await waitFor(() => expect(screen.getByTestId('checkin-stub')).toBeInTheDocument())
  })
})

/**
 * PR2 — task 3.3. Token-present group: `configState.hasMapboxToken = true`
 * makes `map-page.tsx` mount `MapView` instead of `MapUnavailable`.
 * `react-map-gl` is mocked file-wide above (jsdom cannot render WebGL) as a
 * `data-testid="map"` div with one `data-testid="marker-{id}"` button per
 * `Marker`, plus a `data-testid="map-error-trigger"` button that invokes the
 * `Map`'s `onError` callback on demand.
 *
 * Tapping a pin only highlights the matching list item (no store write, no
 * navigation) — list-row clicks keep PR1b's single-step select+navigate
 * behavior unchanged (`place-list-panel.tsx` is out of PR2's scope and its
 * whole row is one click target, so decoupling select-from-navigate on the
 * list side isn't possible without touching that file). Both surfaces read
 * and write the SAME `selectedPlaceId` state in `map-page.tsx`, so the
 * "list -> pin" direction of the sync is exercised by the same code path
 * proven here for "pin -> list"; a list click's highlight is not
 * independently observable in the DOM because it batches with the
 * synchronous navigation away from `MapPage` (documented in apply-progress).
 */
describe('MapPage — map view (token present)', () => {
  beforeEach(() => {
    configState.hasMapboxToken = true
  })

  it('renders the map with one marker per fetched place', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([
          nearbyPlace({ placeId: '1', name: 'El Cielo' }),
          nearbyPlace({ placeId: '2', name: 'Parque Arví' }),
        ])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('map')).toBeInTheDocument())
    expect(screen.getByTestId('marker-1')).toBeInTheDocument()
    expect(screen.getByTestId('marker-2')).toBeInTheDocument()
    expect(screen.queryByTestId('map-unavailable')).not.toBeInTheDocument()
  })

  it('tapping a pin highlights the matching list item without storing or navigating', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([nearbyPlace({ placeId: '1', name: 'El Cielo' })])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('marker-1')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('marker-1'))

    expect(screen.getByRole('button', { name: /el cielo/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(useCheckinStore.getState().selectedPlace).toBeNull()
    expect(screen.queryByTestId('checkin-stub')).not.toBeInTheDocument()
  })

  it('moves the highlight when a different pin is tapped', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([
          nearbyPlace({ placeId: '1', name: 'El Cielo' }),
          nearbyPlace({ placeId: '2', name: 'Parque Arví' }),
        ])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('marker-1')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('marker-1'))
    expect(screen.getByRole('button', { name: /el cielo/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    fireEvent.click(screen.getByTestId('marker-2'))
    expect(screen.getByRole('button', { name: /el cielo/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: /parque arví/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('still stores the place and navigates when selecting from the list with the map mounted', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([nearbyPlace({ placeId: '42', name: 'El Cielo' })])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('marker-42')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /el cielo/i }))

    await waitFor(() => expect(screen.getByTestId('checkin-stub')).toBeInTheDocument())
    expect(useCheckinStore.getState().selectedPlace).toEqual({
      placeId: '42',
      placeName: 'El Cielo',
    })
  })

  it('falls back to MapUnavailable(loadFailed) on a map error without losing the list', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('map')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('map-error-trigger'))

    const unavailable = await screen.findByTestId('map-unavailable')
    expect(unavailable).toHaveAttribute('data-reason', 'loadFailed')
    expect(screen.getByText('El Cielo')).toBeInTheDocument()
  })
})
