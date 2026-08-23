import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { RoutePlaceholder } from './route-placeholder'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from './protected-route'

/**
 * `/login` es hermana del árbol con AppShell, no hija: un usuario deslogueado
 * no debe ver el rail/bottom nav (ver WU8, issue #8), y debe seguir siendo
 * alcanzable sin importar el estado de auth. El árbol con AppShell está
 * envuelto en `ProtectedRoute` (WU7, issue #7) — sin sesión real todavía,
 * usa el stub de `useAuthStore` para decidir si deja pasar o manda a /login.
 * El resto sigue siendo placeholder — sin vistas reales todavía (eso llega
 * con WU9/WU10).
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <RoutePlaceholder label="mapa — pendiente" /> },
          { path: '/rutas', element: <RoutePlaceholder label="rutas — pendiente" /> },
          { path: '/premios', element: <RoutePlaceholder label="premios — pendiente" /> },
          { path: '/perfil', element: <RoutePlaceholder label="perfil — pendiente" /> },
        ],
      },
    ],
  },
])
