import type { AxiosInstance } from 'axios'
import { getActiveLocale } from '@/shared/lib/locale'

/**
 * Outbound `Accept-Language` on every request. Unlike `installAuthInterceptors`,
 * this interceptor has NO skip list: `/auth/login` and `/auth/refresh` are exactly
 * the requests whose server `detail` a logged-out user reads (auth-interceptor.ts),
 * so they must carry the active language too.
 */
export function installLocaleInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    config.headers.set('Accept-Language', getActiveLocale())
    return config
  })
}
