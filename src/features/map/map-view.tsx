import { useEffect, useRef } from 'react'
import { Compass, Crosshair, MapPin, Minus, Plus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Map, Marker, type MapRef } from 'react-map-gl'
import { MAPBOX_TOKEN, resolveMapStyleUrl, type Coordinates } from '@/features/map/map-config'
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme'
import type { NearbyPlace } from '@/shared/schemas/places'

/** Comfortably closer than the initial `zoom: 13` overview, without being a
 * jarring zoom-in — same ballpark as picking a single address on a city map. */
const SELECTED_PLACE_FLY_ZOOM = 15.5
const SELECTED_PLACE_FLY_DURATION_MS = 900
/** Tighter than a picked place's zoom — "this is exactly where I am", not a
 * general area. */
const MY_LOCATION_FLY_ZOOM = 16.5

/** Shared look for every custom map control button — replaces `NavigationControl`
 * (Mapbox's own default-styled zoom/compass cluster read as visibly off-brand
 * against the rest of the redesign) with our own, matching the "center on me"
 * button's already-established style. */
const MAP_CONTROL_BUTTON_CLASS =
  'absolute right-2.5 z-10 flex h-[29px] w-[29px] items-center justify-center rounded-md bg-surface-raised text-ink shadow-md hover:bg-paper'

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
  /** Real GPS fix only (`resolveMapCenter`'s `source: 'gps'`) — `null` on the
   * default-center fallback, so we never render a "you are here" dot at a
   * location we don't actually know. */
  userLocation: Coordinates | null
  onSelectPlace: (place: NearbyPlace) => void
  onError: () => void
}

export function MapView({
  center,
  places,
  selectedPlaceId,
  userLocation,
  onSelectPlace,
  onError,
}: MapViewProps) {
  const { t } = useTranslation('map')
  const mapRef = useRef<MapRef>(null)
  const resolvedTheme = useResolvedTheme()

  // `initialViewState` (below) is exactly that — initial-only, not reactive.
  // Selecting a place (dropdown result or tapping a pin — same `selectedPlaceId`
  // that already drives the pin highlight) doesn't recenter the camera on its
  // own, so the "buscar también me lo busca en el mapa" behavior needs an
  // imperative `flyTo`. Reads `places` via a ref (not a dependency) so a
  // places refetch with the same selection doesn't re-trigger the flight;
  // does nothing when `selectedPlaceId` goes back to `null` (deselect stays
  // put) or points at a place `MapView` doesn't have (yet).
  const placesRef = useRef(places)
  placesRef.current = places

  useEffect(() => {
    if (!selectedPlaceId) return
    const place = placesRef.current.find((candidate) => candidate.placeId === selectedPlaceId)
    if (!place) return
    mapRef.current?.flyTo({
      center: [place.longitude, place.latitude],
      zoom: SELECTED_PLACE_FLY_ZOOM,
      duration: SELECTED_PLACE_FLY_DURATION_MS,
    })
  }, [selectedPlaceId])

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 13 }}
      mapStyle={resolveMapStyleUrl(resolvedTheme)}
      style={{ width: '100%', height: '100%' }}
      onError={() => onError()}
    >
      <button
        type="button"
        data-testid="zoom-in-button"
        aria-label={t('controls.zoomIn')}
        onClick={() => mapRef.current?.zoomIn()}
        className={`${MAP_CONTROL_BUTTON_CLASS} top-2.5`}
      >
        <Plus size={16} weight="bold" />
      </button>
      <button
        type="button"
        data-testid="zoom-out-button"
        aria-label={t('controls.zoomOut')}
        onClick={() => mapRef.current?.zoomOut()}
        className={`${MAP_CONTROL_BUTTON_CLASS} top-[43px]`}
      >
        <Minus size={16} weight="bold" />
      </button>
      <button
        type="button"
        data-testid="reset-north-button"
        aria-label={t('controls.resetNorth')}
        onClick={() => mapRef.current?.resetNorth()}
        className={`${MAP_CONTROL_BUTTON_CLASS} top-[76px]`}
      >
        <Compass size={16} weight="bold" />
      </button>
      {userLocation && (
        <button
          type="button"
          data-testid="locate-me-button"
          aria-label={t('location.centerOnMe')}
          onClick={() =>
            mapRef.current?.flyTo({
              center: [userLocation.lng, userLocation.lat],
              zoom: MY_LOCATION_FLY_ZOOM,
              duration: SELECTED_PLACE_FLY_DURATION_MS,
            })
          }
          className={`${MAP_CONTROL_BUTTON_CLASS} top-[113px]`}
        >
          <Crosshair size={16} weight="bold" />
        </button>
      )}
      {userLocation && (
        <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
          <span
            data-testid="user-location-marker"
            className="relative flex h-4 w-4 items-center justify-center"
          >
            <span className="absolute h-full w-full animate-ping rounded-full bg-teal/40" />
            <span className="relative h-3 w-3 rounded-full border-2 border-surface-raised bg-teal shadow-marker" />
          </span>
        </Marker>
      )}
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
