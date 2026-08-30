import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ImageSquare, WarningCircle, X } from '@phosphor-icons/react'
import { EmptyState } from '@/shared/components/empty-state'
import { Pill } from '@/shared/components/ui/pill'
import { Spinner } from '@/shared/components/ui/spinner'
import { categoryLabelKey } from '@/shared/schemas/places'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { usePlaceDetail } from '@/features/routes/queries'

export interface RouteStopDetailCardProps {
  placeId: string
  onDismiss: () => void
}

/**
 * Rutas stop drill-down — tapping a stop in `RouteDetailModal` fetches
 * `GET /places/{id}` and shows the SAME rich card experience as the map's
 * `SelectedPlaceCard` (photo -> name+badge -> description -> action),
 * swapped in place of the stop list inside the same `TornPanel` shell
 * rather than absolute-positioned over a map (there's no map here).
 *
 * Intentionally NOT a shared component with `SelectedPlaceCard`: that one's
 * `place` prop is a `NearbyPlace` (requires `distanceMeters`, which a
 * by-ID lookup never has), and this one's action is "Check-in" only (no
 * "select on map" story exists in a route-stop context). The photo/fallback
 * treatment below intentionally mirrors it 1:1 (see design note there) —
 * pull it into a shared primitive if a third consumer ever needs it.
 *
 * "Check-in" reuses the EXACT existing flow map's `SelectedPlaceCard` feeds
 * into (`checkinStore.setSelectedPlace` + `navigate('/checkin')`) — trivial
 * to reuse since it's the same one-liner `map-page.tsx`'s `handleCommit`
 * does. No proximity check here (none exists on the frontend to reuse); the
 * check-in page itself is what gates on real proximity.
 */
export function RouteStopDetailCard({ placeId, onDismiss }: RouteStopDetailCardProps) {
  const { t } = useTranslation('routes')
  const navigate = useNavigate()
  const setSelectedPlace = useCheckinStore((state) => state.setSelectedPlace)
  const { data: place, isPending, isError } = usePlaceDetail(placeId)
  const [imageFailed, setImageFailed] = useState(false)

  function handleCheckIn() {
    if (!place) return
    setSelectedPlace({ placeId: place.placeId, placeName: place.name })
    navigate('/checkin')
  }

  if (isPending) {
    return (
      <div
        data-testid="route-stop-detail-loading"
        className="flex items-center justify-center py-10"
      >
        <Spinner size={24} />
      </div>
    )
  }

  if (isError || !place) {
    return (
      <div data-testid="route-stop-detail-error" className="flex flex-col gap-3">
        <EmptyState
          icon={WarningCircle}
          title={t('stopDetail.errorTitle')}
          description={t('stopDetail.errorDescription')}
        />
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-sm border border-border py-2.5 font-sans text-xs font-bold text-ink"
        >
          {t('detail.close')}
        </button>
      </div>
    )
  }

  const photoUrl = place.photos[0]
  const showImage = Boolean(photoUrl) && !imageFailed

  return (
    <div
      data-testid="route-stop-detail-card"
      className="overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg"
    >
      <div className="relative aspect-video w-full bg-surface-teal">
        {showImage ? (
          <img
            data-testid="route-stop-detail-card-photo"
            src={photoUrl}
            alt=""
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            data-testid="route-stop-detail-card-image-fallback"
            className="flex h-full w-full items-center justify-center"
          >
            <ImageSquare size={30} weight="light" className="text-teal/50" />
          </div>
        )}
        <button
          type="button"
          aria-label={t('stopDetail.close')}
          onClick={onDismiss}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-scrim text-on-brand"
        >
          <X size={14} weight="bold" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="truncate font-sans text-sm font-bold text-ink">{place.name}</div>
        <Pill variant="tint" className="w-fit">
          {t(`gamification:interests.${categoryLabelKey(place.category)}`)}
        </Pill>
        <p className="line-clamp-2 font-sans text-[11px] text-muted">{place.description}</p>
        <button
          type="button"
          onClick={handleCheckIn}
          className="mt-1 w-full rounded-sm bg-teal py-2.5 font-sans text-xs font-bold text-on-brand"
        >
          {t('stopDetail.checkIn')}
        </button>
      </div>
    </div>
  )
}
