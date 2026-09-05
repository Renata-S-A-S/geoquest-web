import axios from 'axios'
import i18next from 'i18next'
import { apiClient } from '@/shared/lib/api-client'
import {
  routeDetailResultSchema,
  routeProgressDetailResultSchema,
  routeStartProblemSchema,
  routeStartResponseSchema,
  routeSummaryResultSchema,
  type RouteDetailResult,
  type RouteProgressDetailResult,
  type RouteStartResponse,
  type RouteSummaryResult,
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

/**
 * Read-layer transport (004-routes-read-endpoints, Slice B/C). `GET /routes`
 * has no documented failure path (backend `GetRoutesQuery` never wraps in
 * `Result` — see `ExplorerRoutesEndpoints.ListAsync`), so a network/parse
 * failure simply rejects and the caller (routes-page, slice 3) renders its
 * own error state — same "caller decides" precedent as `getCheckinStatus`.
 */
export async function getRoutes(): Promise<RouteSummaryResult[]> {
  const { data } = await apiClient.get('/routes')
  return routeSummaryResultSchema.array().parse(data)
}

/**
 * `GET /routes/{id}`. A 404 (route missing, or `Draft`/`Archived` —
 * conflated deliberately by the backend, design D3) rejects; the caller
 * decides how to surface it, same as `getCheckinStatus`.
 */
export async function getRouteById(routeId: string): Promise<RouteDetailResult> {
  const { data } = await apiClient.get(`/routes/${routeId}`)
  return routeDetailResultSchema.parse(data)
}

/**
 * `GET /routes/{id}/progress` — the explorer's LAST attempt on this route.
 * A `404` means "never started," which is NOT an error condition (spec
 * "Explorer Progress Detail", Never-started scenario) — this resolves to
 * `null` instead of rejecting. Any other failure (network, unexpected
 * status) still rejects for the caller to handle.
 */
export async function getRouteProgress(routeId: string): Promise<RouteProgressDetailResult | null> {
  try {
    const { data } = await apiClient.get(`/routes/${routeId}/progress`)
    return routeProgressDetailResultSchema.parse(data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null
    }
    throw error
  }
}
