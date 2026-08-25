import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PlaceListPanel } from './place-list-panel'
import type { NearbyPlace } from '@/shared/schemas/places'

/**
 * WU003b (map discovery) PR1b — task 2.3. Search is a pure client-side
 * filter over the already-fetched `places` prop (design decision #3): no
 * network mock is set up here, so a passing "search filters" assertion
 * proves filtering never triggers a request.
 */

function place(overrides: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    placeId: '1',
    name: 'El Cielo',
    description: 'Mirador panorámico',
    category: 4,
    subcategory: 17,
    latitude: 6.21,
    longitude: -75.57,
    distanceMeters: 850,
    pointsReward: 50,
    ...overrides,
  }
}

describe('PlaceListPanel', () => {
  it('renders each place with its category label, formatted distance, and name', () => {
    render(
      <PlaceListPanel
        places={[place()]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('El Cielo')).toBeInTheDocument()
    expect(screen.getByText('Arte')).toBeInTheDocument()
    expect(screen.getByText('850 m de distancia')).toBeInTheDocument()
  })

  it('filters the list client-side as the user types, with no network involved', () => {
    render(
      <PlaceListPanel
        places={[
          place({ placeId: '1', name: 'El Cielo' }),
          place({ placeId: '2', name: 'Parque Arví' }),
        ]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('El Cielo')).toBeInTheDocument()
    expect(screen.getByText('Parque Arví')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'arvi' } })

    expect(screen.queryByText('El Cielo')).not.toBeInTheDocument()
    expect(screen.getByText('Parque Arví')).toBeInTheDocument()
  })

  it('shows an empty state when there are no places at all', () => {
    render(
      <PlaceListPanel
        places={[]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('No hay lugares cerca')).toBeInTheDocument()
  })

  it('shows a distinct no-matches state when a search filters out every place', () => {
    render(
      <PlaceListPanel
        places={[place()]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz-no-match' } })

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(screen.queryByText('No hay lugares cerca')).not.toBeInTheDocument()
  })

  it('calls onSelect with the clicked place', () => {
    const onSelect = vi.fn()
    render(
      <PlaceListPanel
        places={[place({ placeId: '42', name: 'El Cielo' })]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /el cielo/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ placeId: '42' }))
  })

  it('marks the selected place as pressed', () => {
    render(
      <PlaceListPanel
        places={[place({ placeId: '42', name: 'El Cielo' })]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId="42"
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /el cielo/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('shows a loading skeleton instead of the list while loading', () => {
    render(
      <PlaceListPanel
        places={[]}
        isLoading={true}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText('No hay lugares cerca')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeInTheDocument()
  })

  it('shows a load-error message and calls onRetry when the retry button is pressed', () => {
    const onRetry = vi.fn()
    render(
      <PlaceListPanel
        places={[]}
        isLoading={false}
        isError={true}
        onRetry={onRetry}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('No pudimos cargar los lugares cercanos.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('map EN-switch: title and empty state render real English strings', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(
      <PlaceListPanel
        places={[]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Near you')).toBeInTheDocument()
    expect(screen.getByText('No places nearby')).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('es')
    })
  })
})
