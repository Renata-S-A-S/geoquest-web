/**
 * Stub for `virtual:pwa-register/react`, aliased in `vitest.config.ts`.
 *
 * VitePWA is not loaded in the Vitest config, so the real virtual module has
 * no resolver under test — this file exists only to be resolvable so
 * `vi.mock('virtual:pwa-register/react', ...)` can override it per test.
 * Coverage-excluded (`src/test/**`).
 */
export interface RegisterSWResult {
  needRefresh: [boolean, (value: boolean) => void]
  offlineReady: [boolean, (value: boolean) => void]
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
}

export function useRegisterSW(): RegisterSWResult {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }
}
