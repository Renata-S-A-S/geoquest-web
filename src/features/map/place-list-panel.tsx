import { MapPin } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/empty-state'
import { Pill } from '@/shared/components/ui/pill'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/cn'
import { categoryLabelKey, type NearbyPlace } from '@/shared/schemas/places'
import { filterPlaces, formatDistance } from '@/features/map/place-filter'

/**
 * WU003b (map discovery) PR1b — task 2.3/2.4, restructured for the
 * search-first map redesign: the search input now lives in
 * `place-search-bar.tsx` (owned by `map-page.tsx`, which also owns the
 * title); this component takes the query as a controlled prop and stays
 * responsible only for the list itself — skeleton/error/empty/no-matches/
 * results — still a pure client-side filter over the already-fetched
 * `places` (design decision #3: filtering never triggers a new network
 * call). Rendered as the primary content when the map is unavailable.
 */

export interface PlaceListPanelProps {
  places: NearbyPlace[]
  query: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  selectedPlaceId: string | null
  onSelect: (place: NearbyPlace) => void
  className?: string
}

export function PlaceListPanel({
  places,
  query,
  isLoading,
  isError,
  onRetry,
  selectedPlaceId,
  onSelect,
  className,
}: PlaceListPanelProps) {
  const { t } = useTranslation('map')
  const filtered = filterPlaces(places, query)

  return (
    <div className={cn('flex flex-col gap-3 p-4', className)}>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="font-sans text-xs text-ink">{t('errors.loadError')}</span>
          <Button variant="primary" onClick={onRetry}>
            {t('errors.retry')}
          </Button>
        </div>
      ) : places.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t('list.emptyTitle')}
          description={t('list.emptyDescription')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t('list.noMatchesTitle')}
          description={t('list.noMatchesDescription')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((place) => (
            <li key={place.placeId}>
              <button
                type="button"
                aria-pressed={place.placeId === selectedPlaceId}
                aria-label={t('list.selectAria', { name: place.name })}
                onClick={() => onSelect(place)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2.5 text-left',
                  place.placeId === selectedPlaceId && 'border-teal bg-surface-teal'
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-xs font-bold text-ink">{place.name}</span>
                  <div className="flex items-center gap-2" aria-label={t('place.category')}>
                    <Pill variant="tint">
                      {t(`gamification:interests.${categoryLabelKey(place.category)}`)}
                    </Pill>
                    <span className="font-mono text-[11px] text-muted">
                      {t('list.distance', { distance: formatDistance(place.distanceMeters) })}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 font-sans text-[10px] font-bold text-teal">
                  {t('place.checkIn')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
