import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useOnboardingStore } from '@/shared/stores/onboarding-store'

/**
 * Guardia de rutas — WU7 (issue #7). Envuelve el árbol con AppShell (`/`,
 * `/rutas`, `/premios`, `/perfil`). Lee `useAuthStore` para saber si hay
 * sesión.
 *
 * explorer-onboarding-settings PR4 (design decision D1) — un visitante sin
 * sesión ya no siempre va a `/login`: si nunca completó el onboarding
 * (`onboarding-store.hasCompletedOnboarding` ausente/false), va a
 * `/onboarding` (splash); si ya lo completó (ej. cerró sesión, o es un
 * usuario que vuelve en un dispositivo nuevo tras "Ya tengo cuenta"), va a
 * `/login` como antes. `ProtectedRoute` sigue siendo el único punto de
 * decisión "sin sesión → ¿dónde?" — no se agrega un wrapper nuevo.
 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding)

  if (!isAuthenticated) {
    return <Navigate to={hasCompletedOnboarding ? '/login' : '/onboarding'} replace />
  }

  return <Outlet />
}
