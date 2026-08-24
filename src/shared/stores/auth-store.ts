import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

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
 * Store de auth — WU6 (issue #6), reemplaza el stub de WU7. Guarda los
 * tokens reales que devuelve `POST /auth/login`. Persistido en `localStorage`
 * vía `zustand/persist` (WU6b, issue #24) — revierte la decisión original de
 * WU6 (memoria pura): cualquier reload de página (F5, o una URL escrita a
 * mano, que dispara un full page load) perdía la sesión aunque los tokens
 * siguieran vigentes. El refresh de un access token vencido sigue resuelto
 * de forma perezosa por el interceptor de `auth-interceptor.ts` en la
 * primera petición autenticada — no hace falta refrescar al montar.
 *
 * `isAuthenticated` es conceptualmente derivado de `accessToken` (zustand no
 * tiene estado computado de fábrica sin middleware) — por eso se recalcula
 * en los DOS únicos lugares que mutan el store (`login`/`logout`) en vez de
 * ser un campo independiente que se pueda desincronizar.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'geoquest.auth',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
