import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { DEFAULT_CENTER } from '@/features/map/map-config'
import { resolveMapCenter } from '@/features/map/use-map-center'
import { AppShell } from './app-shell'

/**
 * Regression: `MapPage` used to be a plain routed `element` for `/`, so
 * switching tabs (Perfil -> Mapa) unmounted/remounted it — destroying the
 * Mapbox WebGL context and refetching nearby places on every visit. `/`
 * now renders `null` (see `routes.tsx`) and `AppShell` mounts `MapPage`
 * itself, toggling visibility instead of mounting/unmounting it. `hasMapboxToken`
 * stays at its real default (false) here — MapView/react-map-gl aren't under
 * test, only that MapPage's own state (and its data fetch) survives a round
 * trip through another tab.
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
    photos: [],
    ...overrides,
  }
}

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={null} />
            <Route path="/perfil" element={<div data-testid="perfil-stub">Perfil stub</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('AppShell — persistent map across tab navigation', () => {
  it('does not refetch nearby places or lose search state after navigating away and back', async () => {
    vi.mocked(resolveMapCenter).mockResolvedValue({
      center: { lat: 6.211, lng: -75.571 },
      source: 'gps',
    })
    let fetchCount = 0
    server.use(
      http.get(`${baseURL}/places/nearby`, () => {
        fetchCount += 1
        return HttpResponse.json([nearbyPlace()])
      })
    )

    renderShell()

    await waitFor(() => expect(screen.getByText('El Cielo')).toBeInTheDocument())
    expect(fetchCount).toBe(1)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'arvi' } })
    expect(screen.getByRole('textbox')).toHaveValue('arvi')

    // RailNav (desktop, `lg:hidden`-independent in jsdom) and BottomNav both
    // render a "Perfil"/"Mapa" link — jsdom has no viewport, so both exist at
    // once; take whichever matches first.
    fireEvent.click(screen.getAllByRole('link', { name: /perfil/i })[0])
    await waitFor(() => expect(screen.getByTestId('perfil-stub')).toBeInTheDocument())

    // MapPage stays mounted (just hidden) — its query/search state survives.
    expect(screen.getByRole('textbox')).toHaveValue('arvi')

    fireEvent.click(screen.getAllByRole('link', { name: /^mapa/i })[0])
    await waitFor(() => expect(screen.queryByTestId('perfil-stub')).not.toBeInTheDocument())

    expect(screen.getByRole('textbox')).toHaveValue('arvi')
    expect(fetchCount).toBe(1)
  })
})
