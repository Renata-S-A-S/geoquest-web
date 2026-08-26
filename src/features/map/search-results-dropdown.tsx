import { MapPin } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/components/empty-state'
import { Pill } from '@/shared/components/ui/pill'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { filterPlaces, formatDistance } from '@/features/map/place-filter'
import { categoryLabelKey, type NearbyPlace } from '@/shared/schemas/places'

/**
 * Map redesign (search-first layout) — the "estado intermedio" the user
 * asked for: a floating panel below the search bar, over the map, shown
 * while `query` is non-empty. `isSearching` (owned/debounced by
 * `map-page.tsx`) drives a brief skeleton before results/no-matches settle,
 * so the list doesn't flicker on every keystroke. Filtering reuses
 * `filterPlaces` (same pure client-side filter as `place-list-panel.tsx` —
 * `GET /places/nearby` has no free-text query param, design decision #3).
 * Selecting a row is a PREVIEW (drives the shared pin-selection state via
 * the parent's `onSelect`), never a commit/navigate — that stays the list
 * row's job in map-unavailable mode.
 */

export interface SearchResultsDropdownProps {
  places: NearbyPlace[]
  query: string
  isSearching: boolean
  onSelect: (place: NearbyPlace) => void
}

export function SearchResultsDropdown({
  places,
  query,
  isSearching,
  onSelect,
}: SearchResultsDropdownProps) {
  const { t } = useTranslation('map')
  const filtered = filterPlaces(places, query)

  return (
    <div
      data-testid="search-results-dropdown"
      className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-[340px] overflow-y-auto rounded-lg border border-border bg-white p-1.5 shadow-lg"
    >
      {isSearching ? (
        <div className="flex flex-col gap-1.5 p-1" aria-live="polite">
          <span className="sr-only">{t('search.searching')}</span>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t('list.noMatchesTitle')}
          description={t('list.noMatchesDescription')}
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {filtered.map((place) => (
            <li key={place.placeId}>
              <button
                type="button"
                aria-label={t('search.selectAria', { name: place.name })}
                onClick={() => onSelect(place)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-paper"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-xs font-bold text-ink">{place.name}</span>
                  <div className="flex items-center gap-2">
                    <Pill variant="tint">
                      {t(`gamification:interests.${categoryLabelKey(place.category)}`)}
                    </Pill>
                    <span className="font-mono text-[11px] text-muted">
                      {t('list.distance', { distance: formatDistance(place.distanceMeters) })}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
