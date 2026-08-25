import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEFAULT_RADIUS_M, hasMapboxToken } from '@/features/map/map-config'
import { MapUnavailable } from '@/features/map/map-unavailable'
import { PlaceListPanel } from '@/features/map/place-list-panel'
import { useNearbyPlaces } from '@/features/map/queries'
import { resolveMapCenter, type MapCenterResult } from '@/features/map/use-map-center'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import type { NearbyPlace } from '@/shared/schemas/places'

/**
 * `/` — WU003b (map discovery) PR1b, task 2.7. Container: resolves the
 * center via `resolveMapCenter()` (GPS with `DEFAULT_CENTER` fallback,
 * design decision #6), fetches nearby places via `useNearbyPlaces`, and
 * owns selection state. Renders `PlaceListPanel` + `MapUnavailable` only —
 * the list is the primary interaction surface, the map is an enhancement
 * deferred to PR2 (design decision #4). Selecting a place stores it via
 * `checkinStore.setSelectedPlace()` and navigates to `/checkin` (check-in
 * itself is still seed-based until PR3).
 */
export function MapPage() {
  const { t } = useTranslation('map')
  const navigate = useNavigate()
  const setSelectedPlace = useCheckinStore((state) => state.setSelectedPlace)

  const [centerResult, setCenterResult] = useState<MapCenterResult | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)

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

  function handleSelect(place: NearbyPlace) {
    setSelectedPlaceId(place.placeId)
    setSelectedPlace({ placeId: place.placeId, placeName: place.name })
    navigate('/checkin')
  }

  const isLoading = centerResult === null || isPending

  return (
    <div className="flex h-full flex-col gap-3">
      {centerResult?.source === 'default' && (
        <div className="mx-4 mt-3 rounded-md border border-border bg-white px-3 py-2 font-sans text-[10.5px] text-muted">
          {t('location.usingDefault')}
        </div>
      )}

      {!hasMapboxToken && <MapUnavailable reason="missingToken" className="mx-4 mt-3" />}

      <PlaceListPanel
        places={data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        selectedPlaceId={selectedPlaceId}
        onSelect={handleSelect}
      />
    </div>
  )
}
