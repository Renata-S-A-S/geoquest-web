import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/test/msw-server'
import { useCheckinStore } from '@/shared/stores/checkin-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Resets the in-memory zustand state; the store's own localStorage key is
  // wiped by the blanket `localStorage.clear()` right below (Phase 1 apply
  // note: this line was deferred until `checkin-store.ts` existed — PR4).
  useCheckinStore.getState().clearPending()
  window.localStorage.clear()
})
afterAll(() => server.close())
