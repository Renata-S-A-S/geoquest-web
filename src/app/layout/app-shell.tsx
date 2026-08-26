import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './bottom-nav'
import { RailNav } from './rail-nav'
import { PendingCheckinBanner } from './pending-checkin-banner'
import { MapPage } from '@/features/map/map-page'
import { cn } from '@/shared/lib/cn'

/**
 * Shell de navegación de la app: rail lateral fijo desde 1024px, barra inferior
 * por debajo de ese corte. El contenido routeado se monta en <Outlet />.
 *
 * `PendingCheckinBanner` (WU9, issue #9, PR4) vive en la columna interna,
 * entre `RailNav` y `<main>` — nunca se superpone al nav — y resuelve una
 * sola vez, al montar, un check-in que haya quedado pendiente de revisión.
 *
 * `MapPage` is mounted here directly, not through `<Outlet/>` (its route
 * (`/`, in `routes.tsx`) renders `null`) — kept alive at all times and only
 * hidden via `invisible`/`pointer-events-none` when another tab is active.
 * Reported UX bug: switching tabs (e.g. Perfil -> Mapa) via a plain routed
 * element destroyed and recreated the whole Mapbox GL WebGL context on every
 * visit, refetching nearby places and resetting search/selection state.
 * `absolute inset-0` (not `display:none`) so the WebGL canvas never collapses
 * to a 0×0 box while hidden, which can otherwise leave it stuck unsized when
 * shown again.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const isMapRoute = pathname === '/'

  return (
    <div className="flex h-dvh flex-col bg-paper lg:flex-row lg:gap-3 lg:p-3">
      <RailNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PendingCheckinBanner />
        <main className="relative flex-1 overflow-y-auto">
          <div
            className={cn(
              'absolute inset-0',
              isMapRoute ? 'visible' : 'invisible pointer-events-none'
            )}
          >
            <MapPage />
          </div>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
