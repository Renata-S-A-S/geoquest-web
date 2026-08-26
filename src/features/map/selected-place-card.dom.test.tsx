import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectedPlaceCard } from './selected-place-card'
import type { NearbyPlace } from '@/shared/schemas/places'

function place(overrides: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    placeId: '1',
    name: 'Jardín Botánico',
    description: 'Jardín botánico con orquideorama y senderos naturales.',
    category: 1,
    subcategory: 4,
    latitude: 6.2749,
    longitude: -75.5651,
    distanceMeters: 2845,
    pointsReward: 50,
    photos: [],
    ...overrides,
  }
}

describe('SelectedPlaceCard', () => {
  it('shows the name, category badge, and description', () => {
    render(<SelectedPlaceCard place={place()} onCheckIn={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByText('Jardín Botánico')).toBeInTheDocument()
    expect(
      screen.getByText('Jardín botánico con orquideorama y senderos naturales.')
    ).toBeInTheDocument()
  })

  it('renders the image fallback (never a broken image) when the place has no photos', () => {
    render(<SelectedPlaceCard place={place({ photos: [] })} onCheckIn={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByTestId('selected-place-card-image-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('selected-place-card-photo')).not.toBeInTheDocument()
  })

  it('renders the photo when the place has one', () => {
    render(
      <SelectedPlaceCard
        place={place({ photos: ['http://localhost:9000/geoquest-checkins/places/1.jpg'] })}
        onCheckIn={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByTestId('selected-place-card-photo')).toHaveAttribute(
      'src',
      'http://localhost:9000/geoquest-checkins/places/1.jpg'
    )
    expect(screen.queryByTestId('selected-place-card-image-fallback')).not.toBeInTheDocument()
  })

  it('falls back gracefully — not a broken icon or empty gap — when the photo URL fails to load', () => {
    render(
      <SelectedPlaceCard
        place={place({ photos: ['http://localhost:9000/geoquest-checkins/places/1.jpg'] })}
        onCheckIn={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    fireEvent.error(screen.getByTestId('selected-place-card-photo'))

    expect(screen.queryByTestId('selected-place-card-photo')).not.toBeInTheDocument()
    expect(screen.getByTestId('selected-place-card-image-fallback')).toBeInTheDocument()
  })

  it('calls onCheckIn when the Check-in button is pressed', () => {
    const onCheckIn = vi.fn()
    render(<SelectedPlaceCard place={place()} onCheckIn={onCheckIn} onDismiss={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Check-in' }))

    expect(onCheckIn).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when the close button is pressed', () => {
    const onDismiss = vi.fn()
    render(<SelectedPlaceCard place={place()} onCheckIn={vi.fn()} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
