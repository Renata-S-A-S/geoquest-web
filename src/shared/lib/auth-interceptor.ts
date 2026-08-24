import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/shared/stores/auth-store'
import { loginResponseSchema } from '@/shared/schemas/auth'

/**
 * URLs that must never carry an `Authorization` header from this
 * interceptor and must never trigger the 401 refresh-and-retry flow —
 * WU6 (issue #6). Matched as a suffix/`startsWith` against the request URL.
 */
export const AUTH_SKIP_PATHS = ['/auth/login', '/auth/refresh'] as const

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

/** Never intercepted — structurally prevents the refresh call from recursing. */
const rawAxios = axios.create()

let refreshPromise: Promise<string> | null = null

/** Test-only reset seam: clears in-flight refresh state between test cases. */
export function __resetRefreshState(): void {
  refreshPromise = null
}

function isSkipped(url: string | undefined): boolean {
  if (!url) return false
  return AUTH_SKIP_PATHS.some((path) => url.startsWith(path))
}

async function performRefresh(baseURL: string | undefined): Promise<string> {
  const { refreshToken } = useAuthStore.getState()
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const { data } = await rawAxios.post(`${baseURL ?? ''}/auth/refresh`, { refreshToken })
  const tokens = loginResponseSchema.parse(data)
  useAuthStore.getState().login(tokens)
  return tokens.accessToken
}

function ensureRefresh(baseURL: string | undefined): Promise<string> {
  refreshPromise ??= performRefresh(baseURL).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/**
 * Attaches all auth-aware behavior (bearer token, 401 refresh-and-retry) to
 * an axios instance. Call once right after `axios.create(...)`.
 */
export function installAuthInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    if (isSkipped(config.url)) return config

    const { accessToken } = useAuthStore.getState()
    if (accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`)
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!axios.isAxiosError(error)) throw error

      const config = error.config as RetriableConfig | undefined
      if (
        error.response?.status !== 401 ||
        !config ||
        config._retry ||
        isSkipped(config.url)
      ) {
        throw error
      }

      config._retry = true

      let accessToken: string
      try {
        accessToken = await ensureRefresh(config.baseURL)
      } catch {
        useAuthStore.getState().logout()
        throw error
      }

      config.headers.set('Authorization', `Bearer ${accessToken}`)
      return client.request(config)
    },
  )
}
