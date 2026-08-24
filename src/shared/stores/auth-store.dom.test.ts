import { beforeEach, describe, expect, it } from 'vitest'

/**
 * WU6b (issue #24) — `auth-store` persiste tokens en `localStorage` vía
 * `zustand/persist`, revirtiendo la decisión original de WU6 (memoria pura)
 * porque cualquier reload de página (F5, o navegar escribiendo una URL a
 * mano, que dispara un full page load) perdía la sesión aunque los tokens
 * siguieran vigentes. Mismo patrón/razón de test que `checkin-store.dom.test.ts`
 * (WU9): una variante de query-string del specifier fuerza una instancia de
 * módulo genuinamente fresca dentro del mismo archivo de test, simulando un
 * restart de la app.
 */
async function importFreshAuthStore(tag: string) {
  const specifier = '@/shared/stores/auth-store?' + tag
  return import(specifier) as Promise<typeof import('@/shared/stores/auth-store')>
}

const sampleTokens = {
  accessToken: 'access-token-1',
  accessTokenExpiresAtUtc: '2099-01-01T00:00:00Z',
  refreshToken: 'refresh-token-1',
  refreshTokenExpiresAtUtc: '2099-01-02T00:00:00Z',
}

describe('auth-store persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists login() to localStorage and rehydrates a fresh instance as authenticated', async () => {
    const { useAuthStore: firstInstance } = await importFreshAuthStore('fresh-0')
    firstInstance.getState().login(sampleTokens)

    const raw = window.localStorage.getItem('geoquest.auth')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).state.accessToken).toBe('access-token-1')

    const { useAuthStore: secondInstance } = await importFreshAuthStore('fresh-1')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().isAuthenticated).toBe(true)
    expect(secondInstance.getState().accessToken).toBe('access-token-1')
    expect(secondInstance.getState().refreshToken).toBe('refresh-token-1')
  })

  it('logout() clears the persisted key so a fresh instance rehydrates as logged out', async () => {
    const { useAuthStore: firstInstance } = await importFreshAuthStore('fresh-2')
    firstInstance.getState().login(sampleTokens)
    firstInstance.getState().logout()

    const { useAuthStore: secondInstance } = await importFreshAuthStore('fresh-3')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().isAuthenticated).toBe(false)
    expect(secondInstance.getState().accessToken).toBeNull()
  })

  it('a fresh instance with no persisted entry starts logged out', async () => {
    const { useAuthStore } = await importFreshAuthStore('fresh-4')
    await useAuthStore.persist.rehydrate()

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
