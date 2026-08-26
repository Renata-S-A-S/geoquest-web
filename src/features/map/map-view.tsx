import { MapPin } from '@phosphor-icons/react'
import { Map, Marker, NavigationControl } from 'react-map-gl'
import { MAPBOX_TOKEN, MAP_STYLE_URL, type Coordinates } from '@/features/map/map-config'
import type { NearbyPlace } from '@/shared/schemas/places'

/**
 * WU003b (map discovery) PR2 — task 3.2. Thin, declarative `react-map-gl`
 * wrapper: the map itself, one `Marker` per place, and `NavigationControl`.
 * Deliberately holds no state and makes no token/error branching decisions
 * of its own — that responsibility belongs to `map-page.tsx` (design
 * decision 4/5: list is the primary surface, the map is an enhancement,
 * `MapUnavailable` is driven by the container's `hasMapboxToken`/`onError`
 * state). This keeps the component a near-zero-coverage-cost wrapper even
 * though it IS exercised — via a mocked `react-map-gl` — from
 * `map-page.dom.test.tsx`, since real WebGL rendering can't run in jsdom
 * (see the design's testing-strategy table).
 */

export interface MapViewProps {
  center: Coordinates
  places: NearbyPlace[]
  selectedPlaceId: string | null
  onSelectPlace: (place: NearbyPlace) => void
  onError: () => void
}

export function MapView({ center, places, selectedPlaceId, onSelectPlace, onError }: MapViewProps) {
  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 13 }}
      mapStyle={MAP_STYLE_URL}
      style={{ width: '100%', height: '100%' }}
      onError={() => onError()}
    >
      <NavigationControl position="top-right" />
      {places.map((place) => {
        const isSelected = place.placeId === selectedPlaceId
        return (
          <Marker
            key={place.placeId}
            longitude={place.longitude}
            latitude={place.latitude}
            anchor="bottom"
            onClick={(event) => {
              event.originalEvent.stopPropagation()
              onSelectPlace(place)
            }}
          >
            <span data-testid={`marker-${place.placeId}`}>
              <MapPin
                size={28}
                weight={isSelected ? 'fill' : 'regular'}
                className={isSelected ? 'text-teal' : 'text-ink'}
              />
            </span>
          </Marker>
        )
      })}
    </Map>
  )
}
