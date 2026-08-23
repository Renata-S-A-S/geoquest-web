import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Guardia de rutas — WU7 (issue #7). Envuelve el árbol con AppShell (`/`,
 * `/rutas`, `/premios`, `/perfil`). Sin sesión real todavía: lee el stub de
 * `useAuthStore` y manda a `/login` si no hay auth, en vez de dejar pasar
 * directo como si ya estuviera logueado.
 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
