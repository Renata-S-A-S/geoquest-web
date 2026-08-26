import { render, screen, fireEvent } from '@testing-library/react'
import i18next from 'i18next'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PlaceListPanel } from './place-list-panel'
import type { NearbyPlace } from '@/shared/schemas/places'

/**
 * WU003b (map discovery) PR1b — task 2.3, restructured for the
 * search-first map redesign: `PlaceListPanel` no longer owns the search
 * input or its state (moved to `place-search-bar.tsx` / `map-page.tsx`);
 * it takes `query` as a controlled prop and stays responsible only for the
 * list rendering. Filtering coverage below re-renders with a different
 * `query` prop instead of typing into a textbox — there is no textbox in
 * this component anymore.
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
    photos: [],
    ...overrides,
  }
}

describe('PlaceListPanel', () => {
  it('renders each place with its category label, formatted distance, and name', () => {
    render(
      <PlaceListPanel
        places={[place()]}
        query=""
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

  it('filters the list by the query prop, with no network involved', () => {
    const { rerender } = render(
      <PlaceListPanel
        places={[
          place({ placeId: '1', name: 'El Cielo' }),
          place({ placeId: '2', name: 'Parque Arví' }),
        ]}
        query=""
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('El Cielo')).toBeInTheDocument()
    expect(screen.getByText('Parque Arví')).toBeInTheDocument()

    rerender(
      <PlaceListPanel
        places={[
          place({ placeId: '1', name: 'El Cielo' }),
          place({ placeId: '2', name: 'Parque Arví' }),
        ]}
        query="arvi"
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText('El Cielo')).not.toBeInTheDocument()
    expect(screen.getByText('Parque Arví')).toBeInTheDocument()
  })

  it('shows an empty state when there are no places at all', () => {
    render(
      <PlaceListPanel
        places={[]}
        query=""
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('No hay lugares cerca')).toBeInTheDocument()
  })

  it('shows a distinct no-matches state when the query filters out every place', () => {
    render(
      <PlaceListPanel
        places={[place()]}
        query="zzz-no-match"
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(screen.queryByText('No hay lugares cerca')).not.toBeInTheDocument()
  })

  it('calls onSelect with the clicked place', () => {
    const onSelect = vi.fn()
    render(
      <PlaceListPanel
        places={[place({ placeId: '42', name: 'El Cielo' })]}
        query=""
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
        query=""
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
        query=""
        isLoading={true}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText('No hay lugares cerca')).not.toBeInTheDocument()
  })

  it('shows a load-error message and calls onRetry when the retry button is pressed', () => {
    const onRetry = vi.fn()
    render(
      <PlaceListPanel
        places={[]}
        query=""
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

  it('map EN-switch: the empty state renders real English strings', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(
      <PlaceListPanel
        places={[]}
        query=""
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        selectedPlaceId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('No places nearby')).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('es')
    })
  })
})
