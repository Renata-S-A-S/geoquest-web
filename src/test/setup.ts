import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/test/msw-server'
import { __resetRefreshState } from '@/shared/lib/auth-interceptor'
import { useAuthStore } from '@/shared/stores/auth-store'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  useAuthStore.getState().logout()
  __resetRefreshState()
})
afterAll(() => server.close())
