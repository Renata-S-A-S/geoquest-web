import { apiClient } from '@/shared/lib/api-client'

/**
 * The origin MSW handlers must intercept: whatever `apiClient` actually
 * resolves at test time (`VITE_API_BASE_URL`, else its configured fallback).
 *
 * Every test file used to hardcode `http://localhost:5219`, so pointing the
 * client at the deployed API invalidated all handlers at once and the whole
 * suite failed as unhandled requests. Deriving the value keeps the handlers
 * bound to the client instead of to one environment.
 */
export const TEST_API_BASE_URL = apiClient.defaults.baseURL as string
