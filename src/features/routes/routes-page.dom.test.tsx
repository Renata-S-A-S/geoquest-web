import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { RoutesPage } from '@/features/routes/routes-page'
import type { RouteDetailResult, RouteSummaryResult } from '@/features/routes/schemas'

/**
 * `/rutas` — list + detail drill-down. The list is real network data
 * (`GET /routes`, `RouteSummaryResult`), mocked via msw here. Fixtures are
 * local to this file and shaped exactly as the API result contracts the page
 * consumes — a summary carries `stopCount`, never `placeIds`, and never the
 * `status`/`contentVersion`/`createdAtUtc` of the backend domain entity. The
 * ids and Spanish place names are the real seeded Medellín catalog, so the
 * modal's stop taps hit `GET /places/{id}` with ids the backend really has.
 * `POST /routes/{id}/start` (via the detail modal's "Iniciar ruta") is also
 * a real network call, mirroring `map-page.dom.test.tsx`'s pattern.
 */
const baseURL = TEST_API_BASE_URL

const routeA: RouteSummaryResult = {
  id: '957a81ac-0506-48e1-9b24-c37752557e39',
  name: 'Centro histórico de Medellín',
  routeType: 'Recorrido a pie',
  theme: 'Centro histórico',
  stopCount: 5,
  windowDays: 5,
  completionPointsReward: 500,
}

const routeB: RouteSummaryResult = {
  id: '1a7d8846-7cc4-4b55-ac70-5af5fb3f0e73',
  name: 'Naturaleza y ciencia',
  routeType: 'Recorrido a pie',
  theme: 'Aire libre y descubrimiento',
  stopCount: 4,
  windowDays: 7,
  completionPointsReward: 400,
}

/** Non-null `name` on purpose: these assertions match stop labels by text. */
const routeAStops: { placeId: string; name: string }[] = [
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

const routeADetail: RouteDetailResult = {
  id: routeA.id,
  name: routeA.name,
  routeType: routeA.routeType,
  theme: routeA.theme,
  windowDays: routeA.windowDays,
  completionPointsReward: routeA.completionPointsReward,
  stops: routeAStops,
  myProgress: null,
}

function mockRoutesList(routes: RouteSummaryResult[]) {
  server.use(http.get(`${baseURL}/routes`, () => HttpResponse.json(routes)))
}

/**
 * `RouteDetailModal` fetches its own detail via `GET /routes/{id}` (slice
 * 03a-route-detail-modal-async), so opening it in these tests requires
 * mocking that endpoint. The stub mirrors `RouteDetailResult`'s shape
 * one-to-one, matching the summary fixture it drills down from.
 */
function mockRouteDetail(detail: RouteDetailResult = routeADetail) {
  server.use(http.get(`${baseURL}/routes/${detail.id}`, () => HttpResponse.json(detail)))
}

function renderRoutesPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RoutesPage />
    </QueryClientProvider>
  )
}

describe('RoutesPage', () => {
  it('renders one card per published route with theme, routeType, stop count, window days and reward', async () => {
    mockRoutesList([routeA, routeB])
    renderRoutesPage()

    expect(await screen.findByText(routeA.name)).toBeInTheDocument()
    expect(screen.getByText(routeA.theme)).toBeInTheDocument()
    expect(screen.getAllByText(routeA.routeType).length).toBeGreaterThan(0)
    expect(screen.getByText(`${routeA.stopCount} paradas`)).toBeInTheDocument()
    expect(screen.getByText(`${routeA.windowDays} días para completar`)).toBeInTheDocument()
    expect(screen.getByText(`+${routeA.completionPointsReward} pts`)).toBeInTheDocument()

    expect(screen.getByText(routeB.name)).toBeInTheDocument()
    expect(screen.getByText(routeB.theme)).toBeInTheDocument()
  })

  it('shows the loading skeleton while GET /routes is in flight [Loading state]', () => {
    mockRoutesList([routeA, routeB])
    renderRoutesPage()

    expect(screen.getByTestId('routes-list-loading')).toBeInTheDocument()
  })

  it('shows an empty state when the catalog has no published routes', async () => {
    mockRoutesList([])
    renderRoutesPage()

    expect(await screen.findByText('Todavía no hay rutas')).toBeInTheDocument()
  })

  it('shows an inline error and retry button when the list request fails', async () => {
    server.use(http.get(`${baseURL}/routes`, () => HttpResponse.error()))
    renderRoutesPage()

    expect(await screen.findByText('No pudimos cargar las rutas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('opens the detail modal with the ordered stop list when a card is tapped', async () => {
    mockRoutesList([routeA, routeB])
    mockRouteDetail()
    renderRoutesPage()

    fireEvent.click(await screen.findByText(routeA.name))

    const modal = screen.getByTestId('route-detail-modal')
    const stops = await within(modal).findAllByTestId('route-detail-stop')
    expect(stops).toHaveLength(routeADetail.stops.length)
    stops.forEach((stop, index) => {
      expect(within(stop).getByText(routeAStops[index].name)).toBeInTheDocument()
    })
  })

  it('closes the modal on backdrop click and on the close button', async () => {
    mockRoutesList([routeA, routeB])
    mockRouteDetail()
    renderRoutesPage()

    fireEvent.click(await screen.findByText(routeA.name))
    expect(screen.getByTestId('route-detail-modal')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByTestId('route-detail-modal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(routeA.name))
    await screen.findByRole('button', { name: 'Cerrar' })
    fireEvent.click(screen.getByTestId('route-detail-modal-backdrop'))
    expect(screen.queryByTestId('route-detail-modal')).not.toBeInTheDocument()
  })

  it('starting a route calls the real POST /routes/{id}/start and shows a success confirmation', async () => {
    mockRoutesList([routeA, routeB])
    mockRouteDetail()
    let capturedBody: unknown
    server.use(
      http.post(`${baseURL}/routes/${routeA.id}/start`, async ({ request }) => {
        capturedBody = await request.text()
        return HttpResponse.json({ routeProgressId: 'progress-123' }, { status: 201 })
      })
    )

    renderRoutesPage()
    fireEvent.click(await screen.findByText(routeA.name))
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar ruta' }))

    await waitFor(() => expect(screen.getByText('¡Ruta iniciada!')).toBeInTheDocument())
    expect(capturedBody).toBe('')
    expect(screen.queryByRole('button', { name: 'Iniciar ruta' })).not.toBeInTheDocument()
  })

  it('shows an inline error and keeps the start button usable when the backend rejects with 409', async () => {
    mockRoutesList([routeA, routeB])
    mockRouteDetail()
    server.use(
      http.post(`${baseURL}/routes/${routeA.id}/start`, () =>
        HttpResponse.json({ title: 'RouteNotPublished' }, { status: 409 })
      )
    )

    renderRoutesPage()
    fireEvent.click(await screen.findByText(routeA.name))
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar ruta' }))

    await waitFor(() =>
      expect(screen.getByText('Esta ruta todavía no está publicada.')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Iniciar ruta' })).toBeInTheDocument()
  })
})
