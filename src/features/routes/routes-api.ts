import axios from 'axios'
import i18next from 'i18next'
import { apiClient } from '@/shared/lib/api-client'
import {
  routeStartProblemSchema,
  routeStartResponseSchema,
  type RouteStartResponse,
} from '@/features/routes/schemas'

/**
 * Rutas — real write transport. Mirrors `checkin-api.ts`: Zod parse out,
 * calls go through the shared `apiClient` singleton (WU6 interceptors
 * reused), plus a `map*Error` function for problem+json responses.
 *
 * `POST /routes/{id}/start` takes no body (explorer-scoped, auth-gated).
 */
export async function startRoute(routeId: string): Promise<RouteStartResponse> {
  const { data } = await apiClient.post(`/routes/${routeId}/start`)
  return routeStartResponseSchema.parse(data)
}

export type StartRouteError = { kind: 'notFound' | 'notPublished' | 'blocked' | 'unknown' }

/**
 * Maps `POST /routes/{id}/start` errors: `404` -> not found, `409` with a
 * `RouteNotPublished` title -> not published, any other `409` -> a blocked
 * retry rule, anything else (incl. network failure) -> unknown.
 */
export function mapStartRouteError(error: unknown): StartRouteError {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 404) return { kind: 'notFound' }

    if (error.response?.status === 409) {
      const problem = routeStartProblemSchema.safeParse(error.response.data)
      const title = problem.success ? problem.data.title : undefined
      if (title?.includes('RouteNotPublished')) return { kind: 'notPublished' }
      return { kind: 'blocked' }
    }
  }

  return { kind: 'unknown' }
}

/** Static fallback copy for a mapped `StartRouteError`, read from the global `i18next` singleton (non-React caller, same pattern as `checkin-api.ts`). */
export function getStartRouteErrorMessage(errorKind: StartRouteError['kind']): string {
  return i18next.t(`start.errors.${errorKind}`, { ns: 'routes' })
}
