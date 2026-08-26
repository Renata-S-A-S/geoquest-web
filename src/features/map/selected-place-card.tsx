import { useState } from 'react'
import { ImageSquare, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Pill } from '@/shared/components/ui/pill'
import { formatDistance } from '@/features/map/place-filter'
import { categoryLabelKey, type NearbyPlace } from '@/shared/schemas/places'

/**
 * Map redesign — real card (fixed width, `image -> name+badge -> description
 * -> Check-in`) replacing the earlier full-width horizontal bar. Rendered
 * with `key={place.placeId}` by `map-page.tsx` so the image-load-failure
 * state below resets cleanly on a new selection instead of leaking the
 * previous place's fallback/loaded state across a re-render.
 *
 * `place.photos` are real backend data now (`NearbyPlaceResult.Photos`), but
 * today's seed values are placeholder MinIO URLs that mostly 404 — `onError`
 * always falls back to a neutral placeholder tile, never a broken-image icon
 * or an empty gap, and never pretends a photo loaded when it didn't.
 */

export interface SelectedPlaceCardProps {
  place: NearbyPlace
  onCheckIn: () => void
  onDismiss: () => void
}

export function SelectedPlaceCard({ place, onCheckIn, onDismiss }: SelectedPlaceCardProps) {
  const { t } = useTranslation('map')
  const [imageFailed, setImageFailed] = useState(false)

  const photoUrl = place.photos[0]
  const showImage = Boolean(photoUrl) && !imageFailed

  return (
    <div
      data-testid="selected-place-card"
      className="absolute bottom-3 left-1/2 z-10 w-[min(340px,calc(100%-1.5rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-white shadow-lg"
    >
      <div className="relative aspect-video w-full bg-surface-teal">
        {showImage ? (
          <img
            data-testid="selected-place-card-photo"
            src={photoUrl}
            alt=""
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            data-testid="selected-place-card-image-fallback"
            className="flex h-full w-full items-center justify-center"
          >
            <ImageSquare size={30} weight="light" className="text-teal/50" />
          </div>
        )}
        <button
          type="button"
          aria-label={t('place.dismissSelection')}
          onClick={onDismiss}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/55 text-cream"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="truncate font-sans text-sm font-bold text-ink">{place.name}</div>
        <div className="flex items-center gap-2">
          <Pill variant="tint">
            {t(`gamification:interests.${categoryLabelKey(place.category)}`)}
          </Pill>
          <span className="font-mono text-[10px] text-muted">
            {t('list.distance', { distance: formatDistance(place.distanceMeters) })}
          </span>
        </div>
        <p className="line-clamp-2 font-sans text-[11px] text-muted">{place.description}</p>
        <button
          type="button"
          onClick={onCheckIn}
          className="mt-1 w-full rounded-sm bg-teal py-2.5 font-sans text-xs font-bold text-cream"
        >
          {t('place.checkIn')}
        </button>
      </div>
    </div>
  )
}
