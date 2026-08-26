import { forwardRef, useImperativeHandle, type MouseEvent, type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

// `flyTo` regression (camera didn't follow selection — `initialViewState` is
// initial-only): `vi.hoisted` so both the mock factory below and the tests
// can reach the same spies, exposed via a mocked `MapRef` (`useImperativeHandle`).
// `zoomInSpy`/`zoomOutSpy`/`resetNorthSpy` back the custom control cluster
// that replaced Mapbox's own `NavigationControl` (off-brand default styling).
const { flyToSpy, zoomInSpy, zoomOutSpy, resetNorthSpy } = vi.hoisted(() => ({
  flyToSpy: vi.fn(),
  zoomInSpy: vi.fn(),
  zoomOutSpy: vi.fn(),
  resetNorthSpy: vi.fn(),
}))

vi.mock('react-map-gl', () => ({
  Map: forwardRef<
    {
      flyTo: typeof flyToSpy
      zoomIn: typeof zoomInSpy
      zoomOut: typeof zoomOutSpy
      resetNorth: typeof resetNorthSpy
    },
    {
      children?: ReactNode
      onError?: (event: { error: Error }) => void
    }
  >(({ children, onError }, ref) => {
    useImperativeHandle(ref, () => ({
      flyTo: flyToSpy,
      zoomIn: zoomInSpy,
      zoomOut: zoomOutSpy,
      resetNorth: resetNorthSpy,
    }))
    return (
      <div data-testid="map">
        {children}
        <button
          type="button"
          data-testid="map-error-trigger"
          onClick={() => onError?.({ error: new Error('boom') })}
        />
      </div>
    )
  }),
  Marker: ({
    children,
    anchor,
    onClick,
  }: {
    children?: ReactNode
    anchor?: string
    onClick?: (event: { originalEvent: MouseEvent }) => void
  }) => (
    <button
      type="button"
      data-anchor={anchor}
      onClick={(event) => onClick?.({ originalEvent: event })}
    >
      {children}
    </button>
  ),
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
    photos: [],
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
  flyToSpy.mockClear()
  zoomInSpy.mockClear()
  zoomOutSpy.mockClear()
  resetNorthSpy.mockClear()
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
    expect(screen.queryByTestId('search-results-dropdown')).not.toBeInTheDocument()
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
 * PR2 — task 3.3, restructured for the search-first map redesign.
 * Token-present group: `configState.hasMapboxToken = true` makes
 * `map-page.tsx` mount `MapView` instead of `MapUnavailable`.
 * `react-map-gl` is mocked file-wide above (jsdom cannot render WebGL) as a
 * `data-testid="map"` div with one `data-testid="marker-{id}"` button per
 * `Marker`, plus a `data-testid="map-error-trigger"` button that invokes the
 * `Map`'s `onError` callback on demand.
 *
 * The always-visible place list is gone once the map is shown — that's the
 * redesign's whole point (map dominant, list only as the unavailable-map
 * fallback below). Tapping a pin, or picking a row from the search
 * dropdown, is a lightweight PREVIEW: it sets `selectedPlaceId` and shows
 * `SelectedPlaceCard` (no store write, no navigation) — replacing the old
 * "highlighted list row" assertions, which no longer apply with no list on
 * screen. Only the card's own "Check-in" button commits.
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
    await waitFor(() => expect(screen.getByTestId('marker-1')).toBeInTheDocument())
    expect(screen.getByTestId('marker-2')).toBeInTheDocument()
    expect(screen.queryByTestId('map-unavailable')).not.toBeInTheDocument()

    // Regression: MapPin is a teardrop whose tip — not its center — marks the
    // coordinate, so the Marker must anchor at "bottom" or every pin renders
    // offset from its real location (reported against Jardín Botánico).
    expect(screen.getByTestId('marker-1').closest('button')).toHaveAttribute(
      'data-anchor',
      'bottom'
    )
  })

  it('shows a "you are here" dot on a real GPS fix', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('user-location-marker')).toBeInTheDocument())
  })

  it('never shows the "you are here" dot on the default-center fallback', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({ center: DEFAULT_CENTER, source: 'default' })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('map')).toBeInTheDocument())
    expect(screen.queryByTestId('user-location-marker')).not.toBeInTheDocument()
  })

  it('tapping a pin shows the selected-place card as a preview, without storing or navigating', async () => {
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

    const card = await screen.findByTestId('selected-place-card')
    expect(card).toHaveTextContent('El Cielo')
    expect(useCheckinStore.getState().selectedPlace).toBeNull()
    expect(screen.queryByTestId('checkin-stub')).not.toBeInTheDocument()
  })

  it('flies the camera to the tapped pin, but never on mount and never on deselect', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([
          nearbyPlace({ placeId: '1', name: 'El Cielo', latitude: 6.2234, longitude: -75.5802 }),
        ])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('marker-1')).toBeInTheDocument())
    expect(flyToSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('marker-1'))
    await screen.findByTestId('selected-place-card')

    expect(flyToSpy).toHaveBeenCalledTimes(1)
    expect(flyToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-75.5802, 6.2234], zoom: expect.any(Number) })
    )

    fireEvent.click(
      within(screen.getByTestId('selected-place-card')).getByRole('button', {
        name: 'Quitar selección',
      })
    )
    await waitFor(() => expect(screen.queryByTestId('selected-place-card')).not.toBeInTheDocument())

    // Deselecting stays put — the camera doesn't fly back anywhere.
    expect(flyToSpy).toHaveBeenCalledTimes(1)
  })

  it('flies the camera to a place selected from the search dropdown', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(
      http.get(`${baseURL}/places/nearby`, () =>
        HttpResponse.json([
          nearbyPlace({ placeId: '2', name: 'Parque Arví', latitude: 6.2943, longitude: -75.4831 }),
        ])
      )
    )

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('marker-2')).toBeInTheDocument())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'arvi' } })

    const result = await screen.findByRole('button', { name: /parque arv./i })
    fireEvent.click(result)

    await waitFor(() => expect(flyToSpy).toHaveBeenCalledTimes(1))
    expect(flyToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-75.4831, 6.2943], zoom: expect.any(Number) })
    )
  })

  it('shows a "center on me" button on a real GPS fix, and flies the camera to it on click', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.2442, lng: -75.5812 },
      source: 'gps',
    })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    const button = await screen.findByTestId('locate-me-button')
    fireEvent.click(button)

    expect(flyToSpy).toHaveBeenCalledTimes(1)
    expect(flyToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-75.5812, 6.2442], zoom: expect.any(Number) })
    )
  })

  it('never shows the "center on me" button on the default-center fallback', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({ center: DEFAULT_CENTER, source: 'default' })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('map')).toBeInTheDocument())
    expect(screen.queryByTestId('locate-me-button')).not.toBeInTheDocument()
  })

  it("has its own zoom/compass controls (replacing Mapbox's default-styled NavigationControl)", async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    server.use(http.get(`${baseURL}/places/nearby`, () => HttpResponse.json([nearbyPlace()])))

    renderMapPage()

    await waitFor(() => expect(screen.getByTestId('map')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('zoom-in-button'))
    expect(zoomInSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('zoom-out-button'))
    expect(zoomOutSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('reset-north-button'))
    expect(resetNorthSpy).toHaveBeenCalledTimes(1)
  })

  it('moves the selected-place card when a different pin is tapped', async () => {
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
    expect(await screen.findByTestId('selected-place-card')).toHaveTextContent('El Cielo')

    fireEvent.click(screen.getByTestId('marker-2'))
    expect(screen.getByTestId('selected-place-card')).toHaveTextContent('Parque Arví')
  })

  it('still stores the place and navigates when confirming Check-in from the selected-place card', async () => {
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
    fireEvent.click(screen.getByTestId('marker-42'))

    const card = await screen.findByTestId('selected-place-card')
    fireEvent.click(within(card).getByRole('button', { name: 'Check-in' }))

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

  it('shows a debounced "searching" state before dropdown results, and selecting a result previews it on the map', async () => {
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

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'arv' } })

    const dropdown = screen.getByTestId('search-results-dropdown')
    expect(within(dropdown).queryByText('Parque Arví')).not.toBeInTheDocument()

    await waitFor(() => expect(within(dropdown).getByText('Parque Arví')).toBeInTheDocument())

    fireEvent.click(within(dropdown).getByRole('button', { name: /parque arví/i }))

    expect(screen.queryByTestId('search-results-dropdown')).not.toBeInTheDocument()
    const card = await screen.findByTestId('selected-place-card')
    expect(card).toHaveTextContent('Parque Arví')
    expect(useCheckinStore.getState().selectedPlace).toBeNull()
  })

  it('shows a no-matches state in the dropdown when the search has no results', async () => {
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

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz-no-match' } })

    await waitFor(() => expect(screen.getByText('Sin resultados')).toBeInTheDocument())
  })
})
