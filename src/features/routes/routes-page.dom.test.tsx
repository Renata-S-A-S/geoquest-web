import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { MOCK_ROUTES } from '@/features/routes/routes-mock-data'
import { RoutesPage } from '@/features/routes/routes-page'

/**
 * `/rutas` — list + detail drill-down. `MOCK_ROUTES` (real seeded display
 * data, see `routes-mock-data.ts`) drives the list directly — no network
 * mocking needed for it, it's local data. Only `POST /routes/{id}/start`
 * (via the detail modal's "Iniciar ruta") is a real network call and goes
 * through msw, mirroring `map-page.dom.test.tsx`'s pattern.
 */
const baseURL = 'http://localhost:5219'
const [routeA, routeB] = MOCK_ROUTES

function renderRoutesPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RoutesPage />
    </QueryClientProvider>
  )
}

describe('RoutesPage', () => {
  it('renders one card per seeded route with theme, routeType, stop count, window days and reward', () => {
    renderRoutesPage()

    expect(screen.getByText(routeA.name)).toBeInTheDocument()
    expect(screen.getByText(routeA.theme)).toBeInTheDocument()
    expect(screen.getAllByText(routeA.routeType).length).toBeGreaterThan(0)
    expect(screen.getByText(`${routeA.placeIds.length} paradas`)).toBeInTheDocument()
    expect(screen.getByText(`${routeA.windowDays} días para completar`)).toBeInTheDocument()
    expect(screen.getByText(`+${routeA.completionPointsReward} pts`)).toBeInTheDocument()

    expect(screen.getByText(routeB.name)).toBeInTheDocument()
    expect(screen.getByText(routeB.theme)).toBeInTheDocument()
  })

  it('opens the detail modal with the ordered stop list when a card is tapped', () => {
    renderRoutesPage()

    fireEvent.click(screen.getByText(routeA.name))

    const modal = screen.getByTestId('route-detail-modal')
    const stops = within(modal).getAllByTestId('route-detail-stop')
    expect(stops).toHaveLength(routeA.stops.length)
    stops.forEach((stop, index) => {
      expect(within(stop).getByText(routeA.stops[index].name)).toBeInTheDocument()
    })
  })

  it('closes the modal on backdrop click and on the close button', () => {
    renderRoutesPage()

    fireEvent.click(screen.getByText(routeA.name))
    expect(screen.getByTestId('route-detail-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByTestId('route-detail-modal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(routeA.name))
    fireEvent.click(screen.getByTestId('route-detail-modal-backdrop'))
    expect(screen.queryByTestId('route-detail-modal')).not.toBeInTheDocument()
  })

  it('starting a route calls the real POST /routes/{id}/start and shows a success confirmation', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${baseURL}/routes/${routeA.id}/start`, async ({ request }) => {
        capturedBody = await request.text()
        return HttpResponse.json({ routeProgressId: 'progress-123' }, { status: 201 })
      })
    )

    renderRoutesPage()
    fireEvent.click(screen.getByText(routeA.name))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar ruta' }))

    await waitFor(() => expect(screen.getByText('¡Ruta iniciada!')).toBeInTheDocument())
    expect(capturedBody).toBe('')
    expect(screen.queryByRole('button', { name: 'Iniciar ruta' })).not.toBeInTheDocument()
  })

  it('shows an inline error and keeps the start button usable when the backend rejects with 409', async () => {
    server.use(
      http.post(`${baseURL}/routes/${routeA.id}/start`, () =>
        HttpResponse.json({ title: 'RouteNotPublished' }, { status: 409 })
      )
    )

    renderRoutesPage()
    fireEvent.click(screen.getByText(routeA.name))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar ruta' }))

    await waitFor(() =>
      expect(screen.getByText('Esta ruta todavía no está publicada.')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Iniciar ruta' })).toBeInTheDocument()
  })
})
