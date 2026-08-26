import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { RouteStopDetailCard } from '@/features/routes/route-stop-detail-card'

const baseURL = 'http://localhost:5219'
const placeId = '10000000-0000-0000-0000-000000000001'

const placePayload = {
  placeId,
  name: 'Plaza Botero',
  description: 'Plaza pública con 23 esculturas de Fernando Botero.',
  category: 4,
  subcategory: 17,
  latitude: 6.2518,
  longitude: -75.5636,
  pointsReward: 50,
  photos: [
    'http://localhost:9000/geoquest-checkins/places/10000000-0000-0000-0000-000000000001.jpg',
  ],
}

function renderCard(onDismiss = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/rutas']}>
        <RouteStopDetailCard placeId={placeId} onDismiss={onDismiss} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RouteStopDetailCard', () => {
  beforeEach(() => {
    useCheckinStore.setState({ selectedPlace: null })
  })

  it('shows a loading state while the place fetch is in flight', () => {
    server.use(http.get(`${baseURL}/places/:id`, () => new Promise(() => {})))

    renderCard()

    expect(screen.getByTestId('route-stop-detail-loading')).toBeInTheDocument()
  })

  it('renders the name, category badge, description and photo once loaded', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderCard()

    expect(await screen.findByText('Plaza Botero')).toBeInTheDocument()
    expect(
      screen.getByText('Plaza pública con 23 esculturas de Fernando Botero.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('route-stop-detail-card-photo')).toHaveAttribute(
      'src',
      placePayload.photos[0]
    )
  })

  it('renders the image fallback (never a broken image) when the place has no photos', async () => {
    const { photos: _photos, ...rest } = placePayload
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(rest)))

    renderCard()

    expect(await screen.findByTestId('route-stop-detail-card-image-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('route-stop-detail-card-photo')).not.toBeInTheDocument()
  })

  it('falls back gracefully when the photo URL fails to load', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderCard()

    const photo = await screen.findByTestId('route-stop-detail-card-photo')
    fireEvent.error(photo)

    expect(screen.queryByTestId('route-stop-detail-card-photo')).not.toBeInTheDocument()
    expect(screen.getByTestId('route-stop-detail-card-image-fallback')).toBeInTheDocument()
  })

  it('shows an error state (not a blank screen) when the fetch fails', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => new HttpResponse(null, { status: 500 })))

    renderCard()

    expect(await screen.findByTestId('route-stop-detail-error')).toBeInTheDocument()
  })

  it('calls onDismiss from the error state close button', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => new HttpResponse(null, { status: 404 })))
    const onDismiss = vi.fn()

    renderCard(onDismiss)

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when the close button on the loaded card is pressed', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))
    const onDismiss = vi.fn()

    renderCard(onDismiss)

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar detalle de la parada' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('sets the checkin store selected place and navigates to /checkin when Check-in is pressed', async () => {
    server.use(http.get(`${baseURL}/places/:id`, () => HttpResponse.json(placePayload)))

    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar check-in' }))

    await waitFor(() => {
      expect(useCheckinStore.getState().selectedPlace).toEqual({
        placeId,
        placeName: 'Plaza Botero',
      })
    })
  })
})
