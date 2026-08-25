import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { DEFAULT_CENTER } from '@/features/map/map-config'
import { resolveMapCenter } from '@/features/map/use-map-center'
import { MapPage } from './map-page'

/**
 * WU003b (map discovery) PR1b — task 2.6. `MapPage` is the container:
 * `resolveMapCenter()` + `useNearbyPlaces` + selection state, rendering
 * `PlaceListPanel` + `MapUnavailable` only (no `MapView` yet, per design's
 * "Suggested Work Units" table — the map itself lands in PR2). No
 * `VITE_MAPBOX_TOKEN` is set anywhere in this repo/test env, so
 * `hasMapboxToken` is false for every scenario here — `MapUnavailable`
 * always renders, proving the list stays usable without it.
 */

vi.mock('@/features/map/use-map-center', () => ({ resolveMapCenter: vi.fn() }))

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
