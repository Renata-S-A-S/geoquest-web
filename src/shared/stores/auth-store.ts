import { create } from 'zustand'

export interface AuthTokens {
  accessToken: string
  accessTokenExpiresAtUtc: string
  refreshToken: string
  refreshTokenExpiresAtUtc: string
}

export interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAtUtc: string | null
  refreshTokenExpiresAtUtc: string | null
  login: (tokens: AuthTokens) => void
  logout: () => void
}

const loggedOutTokenState = {
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAtUtc: null,
  refreshTokenExpiresAtUtc: null,
} as const

/**
 * Store de auth — WU6 (issue #6), reemplaza el stub de WU7. Ahora guarda los
 * tokens reales que devuelve `POST /auth/login`, pero sigue siendo solo en
 * memoria (sin localStorage): si el login "recuerda" al usuario entre
 * sesiones es una decisión de producto aparte, no incluida acá.
 *
 * `isAuthenticated` es conceptualmente derivado de `accessToken` (zustand no
 * tiene estado computado de fábrica sin middleware) — por eso se recalcula
 * en los DOS únicos lugares que mutan el store (`login`/`logout`) en vez de
 * ser un campo independiente que se pueda desincronizar.
 */
export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  ...loggedOutTokenState,
  login: (tokens) =>
    set({
      isAuthenticated: Boolean(tokens.accessToken),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAtUtc: tokens.accessTokenExpiresAtUtc,
      refreshTokenExpiresAtUtc: tokens.refreshTokenExpiresAtUtc,
    }),
  logout: () => set({ isAuthenticated: false, ...loggedOutTokenState }),
}))
