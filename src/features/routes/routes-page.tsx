import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapTrifold } from '@phosphor-icons/react'
import { RouteCard } from '@/features/routes/route-card'
import { RouteDetailModal } from '@/features/routes/route-detail-modal'
import { EmptyState } from '@/shared/components/empty-state'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useRoutes } from '@/features/routes/queries'
import type { RouteSummaryResult } from '@/features/routes/schemas'

/**
 * `/rutas` — replaces the `<RoutePlaceholder>` stub. Container: fetches the
 * published catalog via `useRoutes()` (`GET /routes`), renders one
 * `RouteCard` per `RouteSummaryResult` and opens `RouteDetailModal` on tap.
 * `selectedRoute` (mirrors `ProfilePage`'s `selectedBadge` pattern) is local
 * UI state — no URL, no store. Loading/error/empty states mirror
 * `LeaderboardPage`'s query-driven list pattern.
 */
export function RoutesPage() {
  const { t } = useTranslation('routes')
  const { data: routes, isPending, isError, refetch } = useRoutes()
  const [selectedRoute, setSelectedRoute] = useState<RouteSummaryResult | null>(null)

  if (isPending) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <span className="font-sans text-xs text-ink">{t('list.loadError')}</span>
        <Button variant="primary" onClick={() => refetch()}>
          {t('list.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 pb-4 pt-3">
      <b className="font-display text-base text-ink">{t('title')}</b>

      {routes.length === 0 ? (
        <EmptyState
          icon={MapTrifold}
          title={t('list.emptyTitle')}
          description={t('list.emptyDescription')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} onSelect={setSelectedRoute} />
          ))}
        </ul>
      )}

      {selectedRoute && (
        <RouteDetailModal
          key={selectedRoute.id}
          routeId={selectedRoute.id}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  )
}
