import { z } from 'zod'

/**
 * Rutas (tours) contracts — mirrors the style of `schemas/checkin.ts` /
 * `schemas/places.ts`: Zod parse in, Zod parse out. Field names confirmed
 * against the backend source (`GeoQuest.Modules.Routes.Domain`).
 *
 * IMPORTANT: the backend currently exposes ONLY write endpoints for Routes
 * (`POST /routes/{id}/start`, and the `/admin/routes/*` admin surface) —
 * there is no `GET /routes` or `GET /routes/{id}` yet. `routeSchema` below
 * documents the real domain shape (used to validate the hand-authored mock
 * data in `routes-mock-data.ts` stays honest to the contract), but nothing
 * in this feature parses a live `Route` off the wire. Only
 * `routeStartResponseSchema` backs a real network call.
 */

export const ROUTE_STATUSES = ['Draft', 'Published', 'Archived'] as const
export const routeStatusSchema = z.enum(ROUTE_STATUSES)
export type RouteStatus = z.infer<typeof routeStatusSchema>

export const routeSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Free text, no closed taxonomy on the backend (e.g. "Recorrido a pie"). */
  routeType: z.string(),
  /** Free text, no closed taxonomy on the backend (e.g. "Centro histórico"). */
  theme: z.string(),
  /** Curation/display order — the order stops should be shown/visited in. */
  placeIds: z.array(z.string()),
  windowDays: z.number().int().min(1),
  completionPointsReward: z.number().int().min(1),
  completionBadgeId: z.string().nullable(),
  contentVersion: z.number().int(),
  status: routeStatusSchema,
  createdAtUtc: z.string(),
})
export type Route = z.infer<typeof routeSchema>

/** `POST /routes/{id}/start` response (201 Created). The one real read this feature performs. */
export const routeStartResponseSchema = z.object({
  routeProgressId: z.string(),
})
export type RouteStartResponse = z.infer<typeof routeStartResponseSchema>

/**
 * `POST /routes/{id}/start` problem+json errors — `404` (route not found) or
 * `409` (`RouteNotPublished` or a blocked-retry rule). Mirrors
 * `problemDetailsSchema` in `schemas/auth.ts`.
 */
export const routeStartProblemSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().optional(),
})
export type RouteStartProblem = z.infer<typeof routeStartProblemSchema>
