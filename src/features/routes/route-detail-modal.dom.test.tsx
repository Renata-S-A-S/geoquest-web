import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { MOCK_ROUTES } from '@/features/routes/routes-mock-data'
import { RouteDetailModal } from '@/features/routes/route-detail-modal'

/**
 * Stop-tap wiring — same drill-down interaction as `SelectedPlaceCard` on
 * the map, but swapped into the modal's own panel body instead of a second
 * overlay. `MOCK_ROUTES[0]`'s stops are real seeded places, so their
 * `placeId`s line up with what `GET /places/{id}` would really return.
 */
const baseURL = 'http://localhost:5219'
const route = MOCK_ROUTES[0]
const firstStop = route.stops[0]

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

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rutas']}>
        <RouteDetailModal route={route} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RouteDetailModal — stop tap', () => {
  it('fetches and shows the rich place detail card when a stop is tapped', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderModal()

    fireEvent.click(screen.getByText(firstStop.name))

    expect(screen.getByTestId('route-stop-detail-loading')).toBeInTheDocument()
    expect(await screen.findByTestId('route-stop-detail-card')).toBeInTheDocument()
    expect(
      screen.getByText('Plaza pública con 23 esculturas de Fernando Botero.')
    ).toBeInTheDocument()
  })

  it('shows an error state (not a blank screen) when the place fetch fails', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => new HttpResponse(null, { status: 500 })))

    renderModal()

    fireEvent.click(screen.getByText(firstStop.name))

    expect(await screen.findByTestId('route-stop-detail-error')).toBeInTheDocument()
  })

  it('returns to the stop list when the stop detail card is dismissed', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderModal()

    fireEvent.click(screen.getByText(firstStop.name))
    await screen.findByTestId('route-stop-detail-card')

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de la parada' }))

    expect(screen.queryByTestId('route-stop-detail-card')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('route-detail-stop')).toHaveLength(route.stops.length)
  })

  it('Escape closes the stop detail first, then the whole modal on a second press', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))
    const onClose = vi.fn()

    renderModal(onClose)

    fireEvent.click(screen.getByText(firstStop.name))
    await screen.findByTestId('route-stop-detail-card')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('route-stop-detail-card')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('backdrop click closes the stop detail first, then the whole modal on a second click', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))
    const onClose = vi.fn()

    renderModal(onClose)

    fireEvent.click(screen.getByText(firstStop.name))
    await screen.findByTestId('route-stop-detail-card')

    fireEvent.click(screen.getByTestId('route-detail-modal-backdrop'))
    expect(screen.queryByTestId('route-stop-detail-card')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('route-detail-modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('waits for pending state cleanup without leaking act warnings', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderModal()
    fireEvent.click(screen.getByText(firstStop.name))

    await waitFor(() => expect(screen.getByTestId('route-stop-detail-card')).toBeInTheDocument())
  })
})
