import { Outlet } from 'react-router-dom'
import { BottomNav } from './bottom-nav'
import { RailNav } from './rail-nav'

/**
 * Shell de navegación de la app: rail lateral fijo desde 1024px, barra inferior
 * por debajo de ese corte. El contenido routeado se monta en <Outlet />.
 */
export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-paper lg:flex-row lg:gap-3 lg:p-3">
      <RailNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
