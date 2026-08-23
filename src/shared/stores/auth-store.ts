import { create } from 'zustand'

export interface AuthState {
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

/**
 * Stub de estado de auth — WU7 (issue #7), solo en memoria, sin persistencia
 * (nada de localStorage). No es sesión real: eso llega con WU6/backend. Su
 * único trabajo hoy es desbloquear el flujo de rutas protegidas para que el
 * founder pueda probar el login → redirect end-to-end.
 */
export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
}))
