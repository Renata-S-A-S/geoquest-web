import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { MOCK_ROUTES } from '@/features/routes/routes-mock-data'
import { RouteDetailModal } from '@/features/routes/route-detail-modal'

/**
 * `RouteDetailModal` fetches its own detail via `GET /routes/{id}`
 * (`useRouteDetail`) instead of receiving a fully-populated route object —
 * the real backend only returns stopless summaries to the list (slice
 * 03a-route-detail-modal-async, decision 1235). This MSW-mocks that
 * endpoint alongside the existing stop-tap `GET /places/{id}` mock.
 *
 * Stops reuse `MOCK_ROUTES[0]`'s real seeded `placeId`s so the stop-tap
 * assertions still line up with what `GET /places/{id}` would really
 * return; the mock's `stops[].category` field is dropped from the detail
 * payload below since the real `RouteStopResult` has no category field —
 * the per-stop category pill is removed from this modal (decision 1235).
 */
const baseURL = 'http://localhost:5219'
const mockRoute = MOCK_ROUTES[0]
const firstStop = mockRoute.stops[0]

const routeDetailPayload = {
  id: mockRoute.id,
  name: mockRoute.name,
  routeType: mockRoute.routeType,
  theme: mockRoute.theme,
  windowDays: mockRoute.windowDays,
  completionPointsReward: mockRoute.completionPointsReward,
  stops: mockRoute.stops.map(({ placeId, name }) => ({ placeId, name })),
  myProgress: null,
}

const placePayload = {
  placeId: firstStop.placeId,
  name: firstStop.name,
  description: 'Plaza pública con 23 esculturas de Fernando Botero.',
  category: 4,
  subcategory: 17,
  latitude: 6.2518,
  longitude: -75.5636,
  pointsReward: 50,
  photos: [],
}

function mockRouteDetail(payload: typeof routeDetailPayload = routeDetailPayload) {
  server.use(http.get(`${baseURL}/routes/${mockRoute.id}`, () => HttpResponse.json(payload)))
}

function renderModal(onClose = vi.fn(), routeId = mockRoute.id) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rutas']}>
        <RouteDetailModal routeId={routeId} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RouteDetailModal — async detail fetch', () => {
  it('shows a loading state while GET /routes/{id} is in flight [Loading state]', () => {
    mockRouteDetail()

    renderModal()

    expect(screen.getByTestId('route-detail-loading')).toBeInTheDocument()
  })

  it('renders the fetched route header and full stop list once loaded', async () => {
    mockRouteDetail()

    renderModal()

    expect(await screen.findByText(mockRoute.name)).toBeInTheDocument()
    expect(screen.getAllByTestId('route-detail-stop')).toHaveLength(mockRoute.stops.length)
    expect(screen.getByText(firstStop.name)).toBeInTheDocument()
  })

  it('does not render a per-stop category pill (decision 1235)', async () => {
    mockRouteDetail()

    renderModal()

    await screen.findByText(firstStop.name)

    expect(screen.queryByText('Arte')).not.toBeInTheDocument()
  })

  it('shows an error state (not a blank screen) when GET /routes/{id} fails [Error state]', async () => {
    server.use(
      http.get(`${baseURL}/routes/${mockRoute.id}`, () => new HttpResponse(null, { status: 500 }))
    )

    renderModal()

    expect(await screen.findByTestId('route-detail-error')).toBeInTheDocument()
  })
})

describe('RouteDetailModal — stop tap', () => {
  it('fetches and shows the rich place detail card when a stop is tapped', async () => {
    mockRouteDetail()
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderModal()

    fireEvent.click(await screen.findByText(firstStop.name))

    expect(screen.getByTestId('route-stop-detail-loading')).toBeInTheDocument()
    expect(await screen.findByTestId('route-stop-detail-card')).toBeInTheDocument()
    expect(
      screen.getByText('Plaza pública con 23 esculturas de Fernando Botero.')
    ).toBeInTheDocument()
  })

  it('shows an error state (not a blank screen) when the place fetch fails', async () => {
    mockRouteDetail()
    server.use(http.get(`${baseURL}/places/:id`, () => new HttpResponse(null, { status: 500 })))

    renderModal()

    fireEvent.click(await screen.findByText(firstStop.name))

    expect(await screen.findByTestId('route-stop-detail-error')).toBeInTheDocument()
  })

  it('returns to the stop list when the stop detail card is dismissed', async () => {
    mockRouteDetail()
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderModal()

    fireEvent.click(await screen.findByText(firstStop.name))
    await screen.findByTestId('route-stop-detail-card')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de la parada' }))

    expect(screen.queryByTestId('route-stop-detail-card')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('route-detail-stop')).toHaveLength(mockRoute.stops.length)
  })

  it('Escape closes the stop detail first, then the whole modal on a second press', async () => {
    mockRouteDetail()
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))
    const onClose = vi.fn()

    renderModal(onClose)

    fireEvent.click(await screen.findByText(firstStop.name))
    await screen.findByTestId('route-stop-detail-card')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('route-stop-detail-card')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click closes the stop detail first, then the whole modal on a second click', async () => {
    mockRouteDetail()
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))
    const onClose = vi.fn()

    renderModal(onClose)

    fireEvent.click(await screen.findByText(firstStop.name))
    await screen.findByTestId('route-stop-detail-card')

    fireEvent.click(screen.getByTestId('route-detail-modal-backdrop'))
    expect(screen.queryByTestId('route-stop-detail-card')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('route-detail-modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('waits for pending state cleanup without leaking act warnings', async () => {
    mockRouteDetail()
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderModal()
    fireEvent.click(await screen.findByText(firstStop.name))

    await waitFor(() => expect(screen.getByTestId('route-stop-detail-card')).toBeInTheDocument())
  })
})
