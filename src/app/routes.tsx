import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { RoutePlaceholder } from './route-placeholder'
import { LoginPage } from '@/features/auth/login-page'
import { CheckinPage } from '@/features/checkin/checkin-page'
import { EditProfilePage } from '@/features/gamification/edit-profile-page'
import { LeaderboardPage } from '@/features/gamification/leaderboard-page'
import { ProfilePage } from '@/features/gamification/profile-page'
import { MapPage } from '@/features/map/map-page'
import { ProtectedRoute } from './protected-route'

/**
 * `/login` es hermana del árbol con AppShell, no hija: un usuario deslogueado
 * no debe ver el rail/bottom nav (ver WU8, issue #8), y debe seguir siendo
 * alcanzable sin importar el estado de auth. `/checkin` (WU9, issue #9) es
 * hermana de AppShell por la misma razón visual (flujo full-bleed sin nav,
 * igual que el mock del design system no muestra navbar en esos 4 estados),
 * pero SÍ vive dentro de `ProtectedRoute` — a diferencia de /login, acá sí
 * hace falta sesión (stub) para entrar. El árbol con AppShell está envuelto
 * en `ProtectedRoute` (WU7, issue #7) — sin sesión real todavía, usa el stub
 * de `useAuthStore` para decidir si deja pasar o manda a /login. `/perfil`,
 * `/perfil/editar` y `/premios/leaderboard` (WU10) ya renderizan vistas
 * reales; `/` (WU003b PR1b) renderiza `MapPage` — lista de lugares cercanos
 * en modo "list-first", el mapa real llega en PR2. `rutas` sigue siendo
 * placeholder — llega en WUs futuras. La ruta índice `/premios` (bare) también sigue siendo
 * placeholder: WU10b (issue closure) repuntó la nav de "Premios" a
 * `/premios/leaderboard`, así que `/premios` ya no es alcanzable desde la
 * navegación — se conserva reservada para la futura pantalla de
 * Recompensas (Slice 004); no es un cambio funcional, solo documentación.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/checkin', element: <CheckinPage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <MapPage /> },
          { path: '/rutas', element: <RoutePlaceholder label="rutas — pendiente" /> },
          { path: '/premios', element: <RoutePlaceholder label="premios — pendiente" /> },
          { path: '/premios/leaderboard', element: <LeaderboardPage /> },
          { path: '/perfil', element: <ProfilePage /> },
          { path: '/perfil/editar', element: <EditProfilePage /> },
        ],
      },
    ],
  },
])
