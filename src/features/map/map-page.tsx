import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEFAULT_RADIUS_M, hasMapboxToken } from '@/features/map/map-config'
import { MapUnavailable } from '@/features/map/map-unavailable'
import { MapView } from '@/features/map/map-view'
import { PlaceListPanel } from '@/features/map/place-list-panel'
import { useNearbyPlaces } from '@/features/map/queries'
import { resolveMapCenter, type MapCenterResult } from '@/features/map/use-map-center'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import type { NearbyPlace } from '@/shared/schemas/places'

/**
 * `/` — WU003b (map discovery) PR1b task 2.7, extended in PR2 task 3.4.
 * Container: resolves the center via `resolveMapCenter()` (GPS with
 * `DEFAULT_CENTER` fallback, design decision #6), fetches nearby places via
 * `useNearbyPlaces`, and owns selection state. The list is the primary
 * interaction surface, the map is an enhancement (design decision #4):
 * `MapView` mounts only once `hasMapboxToken` is true AND the center has
 * resolved; `MapUnavailable` covers the missing-token, load-error
 * (`MapView`'s `onError`), and position-pending cases.
 *
 * Selecting a place from the LIST keeps PR1b's single-step behavior
 * unchanged (stores it via `checkinStore.setSelectedPlace()` and navigates
 * to `/checkin` immediately — `place-list-panel.tsx` is out of PR2's scope).
 * Tapping a PIN only updates `selectedPlaceId` (highlights the matching
 * list item) without storing or navigating — a lightweight preview, not a
 * second confirm step (documented decision, apply-progress).
 */
export function MapPage() {
  const { t } = useTranslation('map')
  const navigate = useNavigate()
  const setSelectedPlace = useCheckinStore((state) => state.setSelectedPlace)

  const [centerResult, setCenterResult] = useState<MapCenterResult | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [mapFailed, setMapFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void resolveMapCenter().then((result) => {
      if (!cancelled) setCenterResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const { data, isPending, isError, refetch } = useNearbyPlaces({
    lat: centerResult?.center.lat ?? 0,
    lng: centerResult?.center.lng ?? 0,
    radiusM: DEFAULT_RADIUS_M,
    enabled: centerResult !== null,
  })

  const places = data ?? []

  function handleSelect(place: NearbyPlace) {
    setSelectedPlaceId(place.placeId)
    setSelectedPlace({ placeId: place.placeId, placeName: place.name })
    navigate('/checkin')
  }

  function handlePinSelect(place: NearbyPlace) {
    setSelectedPlaceId(place.placeId)
  }

  const isLoading = centerResult === null || isPending
  const showMap = hasMapboxToken && !mapFailed

  return (
    <div className="flex h-full flex-col gap-3">
      {centerResult?.source === 'default' && (
        <div className="mx-4 mt-3 rounded-md border border-border bg-white px-3 py-2 font-sans text-[10.5px] text-muted">
          {t('location.usingDefault')}
        </div>
      )}

      {showMap ? (
        centerResult ? (
          <div className="mx-4 mt-3 h-64 overflow-hidden rounded-md border border-border">
            <MapView
              center={centerResult.center}
              places={places}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={handlePinSelect}
              onError={() => setMapFailed(true)}
            />
          </div>
        ) : (
          <Skeleton className="mx-4 mt-3 h-64" />
        )
      ) : (
        <MapUnavailable
          reason={hasMapboxToken ? 'loadFailed' : 'missingToken'}
          className="mx-4 mt-3"
        />
      )}

      <PlaceListPanel
        places={places}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        selectedPlaceId={selectedPlaceId}
        onSelect={handleSelect}
      />
    </div>
  )
}
