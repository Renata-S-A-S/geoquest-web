import { CalendarBlank, MapTrifold, Star } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Pill } from '@/shared/components/ui/pill'
import type { RouteDisplay } from '@/features/routes/routes-mock-data'

export interface RouteCardProps {
  route: RouteDisplay
  onSelect: (route: RouteDisplay) => void
}

/** Rutas list card — name, theme, routeType badge, stop count, window days, points reward. Tapping opens the detail modal. */
export function RouteCard({ route, onSelect }: RouteCardProps) {
  const { t } = useTranslation('routes')

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(route)}
        className="flex w-full flex-col gap-2 rounded-md border border-border bg-white p-3.5 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-display text-sm text-ink">{route.name}</span>
            <span className="font-sans text-[11px] text-muted">{route.theme}</span>
          </div>
          <Pill variant="tint" className="shrink-0">
            <MapTrifold size={12} weight="fill" />
            {route.routeType}
          </Pill>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Pill variant="outline">{t('list.stops', { count: route.placeIds.length })}</Pill>
          <Pill variant="outline">
            <CalendarBlank size={12} weight="bold" />
            {t('list.windowDays', { count: route.windowDays })}
          </Pill>
          <Pill variant="solid">
            <Star size={12} weight="fill" />
            {t('list.reward', { points: route.completionPointsReward })}
          </Pill>
        </div>
      </button>
    </li>
  )
}
