import { useState } from 'react'
import { MagnifyingGlass, MapPin, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/empty-state'
import { Pill } from '@/shared/components/ui/pill'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/cn'
import { categoryLabelKey, type NearbyPlace } from '@/shared/schemas/places'
import { filterPlaces, formatDistance } from '@/features/map/place-filter'

/**
 * WU003b (map discovery) PR1b — task 2.3/2.4. Search is a pure client-side
 * filter (design decision #3): `places` is the full, already-fetched list;
 * this component owns the search-query state and filters locally, so
 * filtering never triggers a new network call. Distinguishes an
 * empty-result-set state (`list.emptyTitle`, no places at all) from a
 * no-matches-after-search state (`list.noMatchesTitle`).
 */

export interface PlaceListPanelProps {
  places: NearbyPlace[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  selectedPlaceId: string | null
  onSelect: (place: NearbyPlace) => void
  className?: string
}

export function PlaceListPanel({
  places,
  isLoading,
  isError,
  onRetry,
  selectedPlaceId,
  onSelect,
  className,
}: PlaceListPanelProps) {
  const { t } = useTranslation('map')
  const [query, setQuery] = useState('')

  const filtered = filterPlaces(places, query)

  return (
    <div className={cn('flex flex-col gap-3 p-4', className)}>
      <b className="font-display text-base text-ink">{t('title')}</b>

      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          role="textbox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="h-9 w-full rounded-xs border border-border bg-white pl-8 pr-8 font-sans text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
        {query.length > 0 && (
          <button
            type="button"
            aria-label={t('search.clear')}
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          >
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

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
