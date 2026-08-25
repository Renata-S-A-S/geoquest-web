import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import i18next from '@/test/i18n'
import { server } from '@/test/msw-server'
import { useCheckinStore } from '@/shared/stores/checkin-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(async () => {
  cleanup()
  server.resetHandlers()
  // Resets the in-memory zustand state; the store's own localStorage key is
  // wiped by the blanket `localStorage.clear()` right below (Phase 1 apply
  // note: this line was deferred until `checkin-store.ts` existed — PR4).
  useCheckinStore.getState().clearPending()
  useCheckinStore.getState().clearSelectedPlace()
  window.localStorage.clear()
  // MANDATORY: the i18next singleton leaks its active language across tests
  // in the same file otherwise (design D-C) — `localStorage.clear()` above
  // does not undo the in-memory language already resolved.
  await i18next.changeLanguage('es')
})
afterAll(() => server.close())
