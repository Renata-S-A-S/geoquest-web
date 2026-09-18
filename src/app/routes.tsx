import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/app-shell'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { SplashPage } from '@/features/onboarding/splash-page'
import { InterestsStepPage } from '@/features/onboarding/interests-step-page'
import { CheckinPage } from '@/features/checkin/checkin-page'
import { EditProfilePage } from '@/features/gamification/edit-profile-page'
import { LeaderboardPage } from '@/features/gamification/leaderboard-page'
import { ProfilePage } from '@/features/gamification/profile-page'
import { RewardsLayout } from './layout/rewards-layout'
import { RewardsPage } from '@/features/rewards/rewards-page'
import { RoutesPage } from '@/features/routes/routes-page'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { SettingsPage } from '@/features/settings/settings-page'
import { TermsPage } from './terms-page'
import { ProtectedRoute } from './protected-route'

/**
 * Issue #115 — the redeem screen is the ONLY lazily-loaded route in this
 * file; everything else is imported eagerly above. It is split because it is
 * the sole consumer of `qrcode.react`, a dependency exactly one screen in
 * the whole app needs and that every other explorer would otherwise download
 * on first paint.
 *
 * `React.lazy` wants a default export and `redeem-page.tsx` has a named one
 * (the repo's convention everywhere), so the promise is remapped rather than
 * a default export added just to satisfy the loader.
 *
 * Its path is `/premios/:rewardId/canjear`, a CHILD of the `/premios`
 * section rather than a sibling flow like `/checkin`. A redemption belongs
 * to one reward, so the reward id belongs in the URL: the screen has to
 * survive a refresh to find the `userRewardId` it persisted, and router
 * state does not. Staying inside `RewardsLayout` also leaves the sub-nav on
 * screen, which is the explorer's way back out. Neither tab reads as active
 * there, correctly — the screen is in the section but on neither tab.
 */
const RedeemPage = lazy(() =>
  import('@/features/rewards/redeem-page').then((module) => ({ default: module.RedeemPage }))
)

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
 * intereses tras registrarse, PR5) SÍ requiere sesión — vive dentro de
 * `ProtectedRoute` pero fuera de `AppShell` (precedente `/checkin`: flujo
 * full-bleed sin nav). `/configuracion` (explorer-onboarding-settings PR6/PR7,
 * design D6/D7) vive dentro de `AppShell` — a diferencia de `/checkin`, esta
 * pantalla SÍ muestra el nav; es la única pantalla de logout/preferencias
 * del explorador autenticado (`ThemeSwitcher` + `LanguageSwitcher`, prefs de
 * notificaciones/privacidad, link a T&C y logout). `/terminos` es hermana
 * pública del árbol, mismo precedente que `/login`. `/perfil`,
 * `/perfil/editar` y `/premios/leaderboard` (WU10) ya renderizan vistas
 * reales; `/` renderiza `null` a propósito — `MapPage` se monta directo en
 * `AppShell` (no vía este Outlet) para sobrevivir la navegación entre tabs
 * sin recrear el contexto WebGL de Mapbox en cada visita (ver el comentario
 * en `app-shell.tsx`). `/rutas` (Rutas/tours) ya renderiza `RoutesPage`,
 * que consume el catálogo publicado vía `GET /routes` — ver
 * `features/routes/`.
 * `/premios` ya no es un placeholder reservado: ahora es una sección con
 * layout propio (`RewardsLayout`, en `app/layout/`). Su ruta índice
 * renderiza `RewardsPage` — el catálogo publicado que consume
 * `GET /rewards`, ver `features/rewards/` — y `/premios/leaderboard` se
 * conserva con la misma URL de siempre, ahora como ruta hija. El layout
 * vive en `app/layout/` y no dentro de un feature porque abarca dos
 * (`features/rewards` y `features/gamification`), igual que el resto del
 * chrome de navegación. La nav principal volvió a apuntar a `/premios`
 * (ver `nav-items.ts`), así que el catálogo es la pantalla de aterrizaje
 * de la sección y el ranking queda a un tap del sub-nav.
 * `/forgot-password` y `/reset-password` (flujo de recuperación de
 * contraseña) son hermanas públicas por la misma razón que `/login`: un
 * usuario deslogueado que olvidó su contraseña necesita alcanzarlas sin
 * sesión, y el link de `/reset-password` llega desde un email externo (no
 * hay forma de que ese click ya traiga una sesión activa).
 */
export const router = createBrowserRouter([
  { path: '/onboarding', element: <SplashPage /> },
  { path: '/registro', element: <RegisterPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/terminos', element: <TermsPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/checkin', element: <CheckinPage /> },
      { path: '/onboarding/intereses', element: <InterestsStepPage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/', element: null },
          { path: '/rutas', element: <RoutesPage /> },
          {
            path: '/premios',
            element: <RewardsLayout />,
            children: [
              { index: true, element: <RewardsPage /> },
              { path: 'leaderboard', element: <LeaderboardPage /> },
              {
                // `:rewardId` is a single segment, so it cannot shadow the
                // literal `leaderboard` sibling above: that path is one
                // segment and this one is two.
                path: ':rewardId/canjear',
                // The Suspense boundary sits on the route element rather than
                // around the whole tree, so a slow chunk never blanks the app
                // shell or the rewards sub-nav — only the panel below them.
                // Its skeleton is `RewardsPage`'s own loading state, so the
                // wait looks the same whether it is the chunk or the network.
                // Inlined instead of extracted into a component because this
                // file exports a router, and `react-refresh/only-export-components`
                // rejects mixing a component declaration into it.
                element: (
                  <Suspense
                    fallback={
                      <div className="flex flex-col gap-2 p-4">
                        <Skeleton className="h-48 w-full" />
                      </div>
                    }
                  >
                    <RedeemPage />
                  </Suspense>
                ),
              },
            ],
          },
          { path: '/perfil', element: <ProfilePage /> },
          { path: '/perfil/editar', element: <EditProfilePage /> },
          { path: '/configuracion', element: <SettingsPage /> },
        ],
      },
    ],
  },
])
