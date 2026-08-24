import { afterAll, afterEach, beforeAll } from 'vitest'
import i18next from '@/test/i18n'
import { server } from '@/test/msw-server'
import { __resetRefreshState } from '@/shared/lib/auth-interceptor'
import { useAuthStore } from '@/shared/stores/auth-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(async () => {
  server.resetHandlers()
  useAuthStore.getState().logout()
  __resetRefreshState()
  // MANDATORY: the i18next singleton leaks its active language across tests
  // in the same file otherwise (design D-C) — a test that calls
  // `changeLanguage('en')` would silently poison every later test.
  await i18next.changeLanguage('es')
})
afterAll(() => server.close())
