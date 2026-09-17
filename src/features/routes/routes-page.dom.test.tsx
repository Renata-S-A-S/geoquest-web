import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { MOCK_ROUTES } from '@/features/routes/routes-mock-data'
import { RoutesPage } from '@/features/routes/routes-page'
import type { RouteSummaryResult } from '@/features/routes/schemas'

/**
 * `/rutas` — list + detail drill-down. The list is real network data
 * (`GET /routes`, `RouteSummaryResult`), mocked via msw here; `MOCK_ROUTES`
 * (`routes-mock-data.ts`) is reused only as realistic fixture content (real
 * seeded ids/placeIds), same idiom as `route-detail-modal.dom.test.tsx`.
 * `POST /routes/{id}/start` (via the detail modal's "Iniciar ruta") is also
 * a real network call, mirroring `map-page.dom.test.tsx`'s pattern.
 */
const baseURL = TEST_API_BASE_URL
const [routeA, routeB] = MOCK_ROUTES

function toSummary(route: (typeof MOCK_ROUTES)[number]): RouteSummaryResult {
  return {
    id: route.id,
    name: route.name,
    routeType: route.routeType,
    theme: route.theme,
    stopCount: route.placeIds.length,
    windowDays: route.windowDays,
    completionPointsReward: route.completionPointsReward,
  }
}

function mockRoutesList(routes: RouteSummaryResult[]) {
  server.use(http.get(`${baseURL}/routes`, () => HttpResponse.json(routes)))
}

/**
 * `RouteDetailModal` fetches its own detail via `GET /routes/{id}` (slice
 * 03a-route-detail-modal-async), so opening it in these tests requires
 * mocking that endpoint. The stub mirrors `RouteDetailResult`'s shape
 * one-to-one off the same seeded mock data the list summary is built from.
 */
function mockRouteDetail(route: (typeof MOCK_ROUTES)[number]) {
  server.use(
    http.get(`${baseURL}/routes/${route.id}`, () =>
      HttpResponse.json({
        id: route.id,
        name: route.name,
        routeType: route.routeType,
        theme: route.theme,
        windowDays: route.windowDays,
        completionPointsReward: route.completionPointsReward,
        stops: route.stops.map(({ placeId, name }) => ({ placeId, name })),
        myProgress: null,
      })
    )
  )
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
    mockRoutesList([toSummary(routeA), toSummary(routeB)])
    renderRoutesPage()

    expect(await screen.findByText(routeA.name)).toBeInTheDocument()
    expect(screen.getByText(routeA.theme)).toBeInTheDocument()
    expect(screen.getAllByText(routeA.routeType).length).toBeGreaterThan(0)
    expect(screen.getByText(`${routeA.placeIds.length} paradas`)).toBeInTheDocument()
    expect(screen.getByText(`${routeA.windowDays} días para completar`)).toBeInTheDocument()
    expect(screen.getByText(`+${routeA.completionPointsReward} pts`)).toBeInTheDocument()

    expect(screen.getByText(routeB.name)).toBeInTheDocument()
    expect(screen.getByText(routeB.theme)).toBeInTheDocument()
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
    mockRoutesList([toSummary(routeA), toSummary(routeB)])
    mockRouteDetail(routeA)
    renderRoutesPage()

    fireEvent.click(await screen.findByText(routeA.name))

    const modal = screen.getByTestId('route-detail-modal')
    const stops = await within(modal).findAllByTestId('route-detail-stop')
    expect(stops).toHaveLength(routeA.stops.length)
    stops.forEach((stop, index) => {
      expect(within(stop).getByText(routeA.stops[index].name)).toBeInTheDocument()
    })
  })

  it('closes the modal on backdrop click and on the close button', async () => {
    mockRoutesList([toSummary(routeA), toSummary(routeB)])
    mockRouteDetail(routeA)
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
    mockRoutesList([toSummary(routeA), toSummary(routeB)])
    mockRouteDetail(routeA)
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
    mockRoutesList([toSummary(routeA), toSummary(routeB)])
    mockRouteDetail(routeA)
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
