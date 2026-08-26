import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RouteCard } from '@/features/routes/route-card'
import { RouteDetailModal } from '@/features/routes/route-detail-modal'
import { MOCK_ROUTES } from '@/features/routes/routes-mock-data'
import type { RouteDisplay } from '@/features/routes/routes-mock-data'

/**
 * `/rutas` — replaces the `<RoutePlaceholder>` stub. Container: renders one
 * `RouteCard` per seeded route (`routes-mock-data.ts`, pending a backend
 * read endpoint — see that file's comment) and opens `RouteDetailModal` on
 * tap. `selectedRoute` (mirrors `ProfilePage`'s `selectedBadge` pattern) is
 * local UI state — no URL, no store.
 */
export function RoutesPage() {
  const { t } = useTranslation('routes')
  const [selectedRoute, setSelectedRoute] = useState<RouteDisplay | null>(null)

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 pb-4 pt-3">
      <b className="font-display text-base text-ink">{t('title')}</b>

      <ul className="flex flex-col gap-3">
        {MOCK_ROUTES.map((route) => (
          <RouteCard key={route.id} route={route} onSelect={setSelectedRoute} />
        ))}
      </ul>

      {selectedRoute && (
        <RouteDetailModal
          key={selectedRoute.id}
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  )
}
