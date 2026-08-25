import { MapTrifold, WarningCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'

/**
 * WU003b (map discovery) PR1b — task 2.5. Named fallback panel (design
 * decision #5): shown instead of `MapView` (deferred to PR2) either because
 * `VITE_MAPBOX_TOKEN` is absent (`missingToken`) or `react-map-gl`'s
 * `onError` fired (`loadFailed`, wired in PR2). No dedicated unit test file
 * — exercised through `map-page.dom.test.tsx`'s token-missing scenario
 * (task 2.6), per the design's own testing-strategy table.
 */

export type MapUnavailableReason = 'missingToken' | 'loadFailed'

export interface MapUnavailableProps {
  reason: MapUnavailableReason
  className?: string
}

export function MapUnavailable({ reason, className }: MapUnavailableProps) {
  const { t } = useTranslation('map')
  const Icon = reason === 'missingToken' ? MapTrifold : WarningCircle

  return (
    <div
      data-testid="map-unavailable"
      data-reason={reason}
      className={cn(
        'flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-white p-4 text-center',
        className
      )}
    >
      <Icon size={22} weight="fill" className="text-muted" />
      <b className="font-sans text-xs font-bold text-ink">{t('mapUnavailable.title')}</b>
      <span className="font-sans text-[11px] text-muted">
        {reason === 'missingToken'
          ? t('mapUnavailable.missingToken')
          : t('mapUnavailable.loadFailed')}
      </span>
      <span className="font-sans text-[10px] text-muted">{t('mapUnavailable.listHint')}</span>
    </div>
  )
}
