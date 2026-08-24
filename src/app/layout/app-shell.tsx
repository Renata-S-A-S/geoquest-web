import { Outlet } from 'react-router-dom'
import { BottomNav } from './bottom-nav'
import { RailNav } from './rail-nav'
import { PendingCheckinBanner } from './pending-checkin-banner'

/**
 * Shell de navegación de la app: rail lateral fijo desde 1024px, barra inferior
 * por debajo de ese corte. El contenido routeado se monta en <Outlet />.
 *
 * `PendingCheckinBanner` (WU9, issue #9, PR4) vive en la columna interna,
 * entre `RailNav` y `<main>` — nunca se superpone al nav — y resuelve una
 * sola vez, al montar, un check-in que haya quedado pendiente de revisión.
 */
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-paper lg:flex-row lg:gap-3 lg:p-3">
      <RailNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PendingCheckinBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
