import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchResultsDropdown } from './search-results-dropdown'
import type { NearbyPlace } from '@/shared/schemas/places'

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

describe('SearchResultsDropdown', () => {
  it('shows a loading skeleton while searching, hiding results', () => {
    render(
      <SearchResultsDropdown
        places={[place()]}
        query="cielo"
        isSearching={true}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText('El Cielo')).not.toBeInTheDocument()
  })

  it('shows the filtered results once searching finishes', () => {
    render(
      <SearchResultsDropdown
        places={[
          place({ placeId: '1', name: 'El Cielo' }),
          place({ placeId: '2', name: 'Parque Arví' }),
        ]}
        query="arvi"
        isSearching={false}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText('El Cielo')).not.toBeInTheDocument()
    expect(screen.getByText('Parque Arví')).toBeInTheDocument()
  })

  it('shows a no-matches state when nothing matches the query', () => {
    render(
      <SearchResultsDropdown
        places={[place()]}
        query="zzz-no-match"
        isSearching={false}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('calls onSelect with the clicked place', () => {
    const onSelect = vi.fn()
    render(
      <SearchResultsDropdown
        places={[place({ placeId: '42', name: 'El Cielo' })]}
        query="cielo"
        isSearching={false}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /el cielo/i }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ placeId: '42' }))
  })
})
