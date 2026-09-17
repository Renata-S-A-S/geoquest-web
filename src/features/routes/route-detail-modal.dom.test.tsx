import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { RouteDetailModal } from '@/features/routes/route-detail-modal'
import type { RouteDetailResult } from '@/features/routes/schemas'

/**
 * `RouteDetailModal` fetches its own detail via `GET /routes/{id}`
 * (`useRouteDetail`) instead of receiving a fully-populated route object —
 * the real backend only returns stopless summaries to the list (slice
 * 03a-route-detail-modal-async, decision 1235). This MSW-mocks that
 * endpoint alongside the existing stop-tap `GET /places/{id}` mock.
 *
 * The payload below is a local fixture shaped exactly as `RouteDetailResult`:
 * no `placeIds`, no `status`/`contentVersion`/`createdAtUtc`, and no per-stop
 * `category` (the real `RouteStopResult` has none, and the category pill was
 * removed from this modal — decision 1235). Its ids are the real seeded
 * Medellín `placeId`s, so the stop-tap assertions line up with what
 * `GET /places/{id}` would really return.
 */
const baseURL = TEST_API_BASE_URL

/** Non-null `name` on purpose: these assertions match stop labels by text. */
const routeStops: { placeId: string; name: string }[] = [
  { placeId: '10000000-0000-0000-0000-000000000001', name: 'Plaza Botero' },
  { placeId: '10000000-0000-0000-0000-000000000002', name: 'Museo de Antioquia' },
  {
    placeId: '10000000-0000-0000-0000-000000000003',
    name: 'Catedral Metropolitana de Medellín',
  },
  { placeId: '10000000-0000-0000-0000-000000000010', name: 'Palacio de la Cultura' },
  {
    placeId: '10000000-0000-0000-0000-000000000020',
    name: 'Plaza Minorista José María Villa',
  },
]

const firstStop = routeStops[0]

const routeDetailPayload: RouteDetailResult = {
  id: '957a81ac-0506-48e1-9b24-c37752557e39',
  name: 'Centro histórico de Medellín',
  routeType: 'Recorrido a pie',
  theme: 'Centro histórico',
  windowDays: 5,
  completionPointsReward: 500,
  stops: routeStops,
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
  xpReward: 50,
  geoPointsReward: 0,
  photos: [],
}

function mockRouteDetail(payload: RouteDetailResult = routeDetailPayload) {
  server.use(http.get(`${baseURL}/routes/${payload.id}`, () => HttpResponse.json(payload)))
}

function renderModal(onClose = vi.fn(), routeId = routeDetailPayload.id) {
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

    expect(await screen.findByText(routeDetailPayload.name)).toBeInTheDocument()
    expect(screen.getAllByTestId('route-detail-stop')).toHaveLength(routeStops.length)
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
      http.get(
        `${baseURL}/routes/${routeDetailPayload.id}`,
        () => new HttpResponse(null, { status: 500 })
      )
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
    expect(screen.getAllByTestId('route-detail-stop')).toHaveLength(routeStops.length)
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
