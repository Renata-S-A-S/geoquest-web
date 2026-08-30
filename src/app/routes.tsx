import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { RoutePlaceholder } from './route-placeholder'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { SplashPage } from '@/features/onboarding/splash-page'
import { CheckinPage } from '@/features/checkin/checkin-page'
import { EditProfilePage } from '@/features/gamification/edit-profile-page'
import { LeaderboardPage } from '@/features/gamification/leaderboard-page'
import { ProfilePage } from '@/features/gamification/profile-page'
import { RoutesPage } from '@/features/routes/routes-page'
import { ProtectedRoute } from './protected-route'

/**
 * `/login` es hermana del árbol con AppShell, no hija: un usuario deslogueado
 * no debe ver el rail/bottom nav (ver WU8, issue #8), y debe seguir siendo
 * alcanzable sin importar el estado de auth. `/checkin` (WU9, issue #9) es
 * hermana de AppShell por la misma razón visual (flujo full-bleed sin nav,
 * igual que el mock del design system no muestra navbar en esos 4 estados),
 * pero SÍ vive dentro de `ProtectedRoute` — a diferencia de /login, acá sí
 * hace falta sesión (stub) para entrar. El árbol con AppShell está envuelto
 * en `ProtectedRoute` (WU7, issue #7) — usa `useAuthStore` para decidir si
 * deja pasar. explorer-onboarding-settings PR4 (design D1): `ProtectedRoute`
 * ahora manda a `/onboarding` (en vez de siempre `/login`) cuando el visitante
 * sin sesión nunca completó el onboarding — por eso `/onboarding` (splash) y
 * `/registro` (PR3, recién alcanzable desde acá) son hermanas públicas del
 * árbol, mismo precedente que `/login`. `/onboarding/intereses` (el paso de
 * intereses tras registrarse) NO se cablea en este PR — vive dentro de
 * `ProtectedRoute` pero fuera de `AppShell` (precedente `/checkin`) y su
 * componente + wiring de ruta son responsabilidad de PR5. `/perfil`,
 * `/perfil/editar` y `/premios/leaderboard` (WU10) ya renderizan vistas
 * reales; `/` renderiza `null` a propósito — `MapPage` se monta directo en
 * `AppShell` (no vía este Outlet) para sobrevivir la navegación entre tabs
 * sin recrear el contexto WebGL de Mapbox en cada visita (ver el comentario
 * en `app-shell.tsx`). `/rutas` (Rutas/tours) ya renderiza `RoutesPage` —
 * ver `features/routes/` (mock display data pendiente de un endpoint de
 * lectura real en el backend, documentado en `routes-mock-data.ts`).
 * La ruta índice `/premios` (bare) sigue siendo
 * placeholder: WU10b (issue closure) repuntó la nav de "Premios" a
 * `/premios/leaderboard`, así que `/premios` ya no es alcanzable desde la
 * navegación — se conserva reservada para la futura pantalla de
 * Recompensas (Slice 004); no es un cambio funcional, solo documentación.
 */
export const router = createBrowserRouter([
  { path: '/onboarding', element: <SplashPage /> },
  { path: '/registro', element: <RegisterPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/checkin', element: <CheckinPage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/', element: null },
          { path: '/rutas', element: <RoutesPage /> },
          { path: '/premios', element: <RoutePlaceholder label="premios — pendiente" /> },
          { path: '/premios/leaderboard', element: <LeaderboardPage /> },
          { path: '/perfil', element: <ProfilePage /> },
          { path: '/perfil/editar', element: <EditProfilePage /> },
        ],
      },
    ],
  },
])
