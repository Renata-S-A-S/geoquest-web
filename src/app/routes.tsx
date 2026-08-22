import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { RoutePlaceholder } from './route-placeholder'

/**
 * Rutas placeholder — sin vistas reales todavía (eso llega con WU8/WU9/WU10).
 * Solo prueban que el shell de navegación y el corte responsive funcionan.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <RoutePlaceholder label="mapa — pendiente" /> },
      { path: '/rutas', element: <RoutePlaceholder label="rutas — pendiente" /> },
      { path: '/premios', element: <RoutePlaceholder label="premios — pendiente" /> },
      { path: '/perfil', element: <RoutePlaceholder label="perfil — pendiente" /> },
    ],
  },
])
