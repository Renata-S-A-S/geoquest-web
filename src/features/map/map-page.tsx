import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DEFAULT_RADIUS_M, hasMapboxToken } from '@/features/map/map-config'
import { InterestsNudgeBanner } from '@/features/map/interests-nudge-banner'
import { MapUnavailable } from '@/features/map/map-unavailable'
import { MapView } from '@/features/map/map-view'
import { PlaceListPanel } from '@/features/map/place-list-panel'
import { PlaceSearchBar } from '@/features/map/place-search-bar'
import { SearchResultsDropdown } from '@/features/map/search-results-dropdown'
import { SelectedPlaceCard } from '@/features/map/selected-place-card'
import { useNearbyPlaces } from '@/features/map/queries'
import { resolveMapCenter, type MapCenterResult } from '@/features/map/use-map-center'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import type { NearbyPlace } from '@/shared/schemas/places'

const SEARCH_DEBOUNCE_MS = 350

/**
 * `/` — WU003b (map discovery) PR1b/PR2, restructured for the search-first
 * map redesign: the map is now the dominant surface when available
 * (inverts the earlier "list is primary, map is an enhancement" decision).
 * The search bar moves to the top of the page and drives two things: a
 * floating `SearchResultsDropdown` over the map (with a debounced
 * "searching" intermediate state before results/no-matches — the
 * requested "estado intermedio"), and, when the map is unavailable, the
 * `PlaceListPanel` filter (same `query`, no duplicated filtering logic).
 *
 * Selection stays two-tier, as before: tapping a PIN or picking a dropdown
 * row is a lightweight PREVIEW (`selectedPlaceId` only — shows
 * `SelectedPlaceCard`, no store write, no navigation). Only the card's own
 * "Check-in" button, or a list-row click in map-unavailable mode, commits
 * via `checkinStore.setSelectedPlace()` and navigates to `/checkin`.
 *
 * explorer-onboarding-settings PR5 (design D8) — `InterestsNudgeBanner`
 * mounts unconditionally at the top; it decides its own visibility (reads
 * `useExplorerProfile()` internally, renders null unless the authenticated
 * explorer has zero interests) so this container carries no extra fetch or
 * branching for it.
 */
export function MapPage() {
  const { t } = useTranslation('map')
  const navigate = useNavigate()
  const setSelectedPlace = useCheckinStore((state) => state.setSelectedPlace)

  const [centerResult, setCenterResult] = useState<MapCenterResult | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void resolveMapCenter().then((result) => {
      if (!cancelled) setCenterResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const { data, isPending, isError, refetch } = useNearbyPlaces({
    lat: centerResult?.center.lat ?? 0,
    lng: centerResult?.center.lng ?? 0,
    radiusM: DEFAULT_RADIUS_M,
    enabled: centerResult !== null,
  })

  const places = data ?? []
  const selectedPlace = places.find((place) => place.placeId === selectedPlaceId) ?? null

  function previewSelect(place: NearbyPlace) {
    setSelectedPlaceId(place.placeId)
  }

  function handleQueryChange(value: string) {
    clearTimeout(debounceRef.current)
    if (value.length === 0) {
      setQuery('')
      setDropdownOpen(false)
      setIsSearching(false)
      return
    }
    setQuery(value)
    setDropdownOpen(true)
    setIsSearching(true)
    debounceRef.current = setTimeout(() => setIsSearching(false), SEARCH_DEBOUNCE_MS)
  }

  function handleSearchFocus() {
    if (query.length > 0) setDropdownOpen(true)
  }

  function handlePinSelect(place: NearbyPlace) {
    previewSelect(place)
  }

  function handleSearchSelect(place: NearbyPlace) {
    clearTimeout(debounceRef.current)
    previewSelect(place)
    setQuery(place.name)
    setDropdownOpen(false)
    setIsSearching(false)
  }

  function handleCommit(place: NearbyPlace) {
    setSelectedPlaceId(place.placeId)
    setSelectedPlace({ placeId: place.placeId, placeName: place.name })
    navigate('/checkin')
  }

  const isLoading = centerResult === null || isPending
  const showMap = hasMapboxToken && !mapFailed

  return (
    <div className="flex h-full flex-col">
      <InterestsNudgeBanner />

      {centerResult?.source === 'default' && (
        <div className="mx-4 mt-3 shrink-0 rounded-md border border-border bg-white px-3 py-2 font-sans text-[10.5px] text-muted">
          {t('location.usingDefault')}
        </div>
      )}

      <div className="relative z-10 flex shrink-0 flex-col gap-2 px-4 pb-2 pt-3">
        <b className="font-display text-base text-ink">{t('title')}</b>
        <PlaceSearchBar value={query} onChange={handleQueryChange} onFocus={handleSearchFocus} />
        {showMap && dropdownOpen && query.length > 0 && (
          <SearchResultsDropdown
            places={places}
            query={query}
            isSearching={isSearching}
            onSelect={handleSearchSelect}
          />
        )}
      </div>

      {showMap ? (
        centerResult ? (
          <div className="relative mx-4 mb-3 flex-1 overflow-hidden rounded-xl border border-border">
            <MapView
              center={centerResult.center}
              places={places}
              selectedPlaceId={selectedPlaceId}
              userLocation={centerResult.source === 'gps' ? centerResult.center : null}
              onSelectPlace={handlePinSelect}
              onError={() => setMapFailed(true)}
            />
            {selectedPlace && (
              <SelectedPlaceCard
                key={selectedPlace.placeId}
                place={selectedPlace}
                onCheckIn={() => handleCommit(selectedPlace)}
                onDismiss={() => setSelectedPlaceId(null)}
              />
            )}
          </div>
        ) : (
          <Skeleton className="mx-4 mb-3 flex-1" />
        )
      ) : (
        <div className="mx-4 mb-3 flex flex-1 flex-col gap-3 overflow-y-auto">
          <MapUnavailable reason={hasMapboxToken ? 'loadFailed' : 'missingToken'} />
          <PlaceListPanel
            places={places}
            query={query}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
            selectedPlaceId={selectedPlaceId}
            onSelect={handleCommit}
          />
        </div>
      )}
    </div>
  )
}
