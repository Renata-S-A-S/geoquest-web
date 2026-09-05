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

/**
 * Read-layer contracts (004-routes-read-endpoints, Slice B/C) — the mock
 * data note above is now obsolete for these shapes: `GET /routes`,
 * `GET /routes/{id}`, and `GET /routes/{id}/progress` are real backend
 * endpoints. Field names and nullability confirmed against
 * `GeoQuest.Modules.Routes.Contracts.{RouteSummaryResult,RouteDetailResult,
 * RouteStopResult,RouteProgressSummaryResult,RouteProgressDetailResult,
 * RouteProgressStopResult}` (ASP.NET's default camelCase policy only
 * lowercases the first character of each property name).
 */

/** `GET /routes` list item (`RouteSummaryResult`) — only `Published` routes, never `status`/`contentVersion`. */
export const routeSummaryResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  routeType: z.string(),
  theme: z.string(),
  stopCount: z.number().int(),
  windowDays: z.number().int(),
  completionPointsReward: z.number().int(),
})
export type RouteSummaryResult = z.infer<typeof routeSummaryResultSchema>

/** Curated/display stop of `RouteDetailResult.Stops` (`RouteStopResult`). `name` is `null` while the `PlaceRef` projection hasn't caught up yet. */
export const routeStopResultSchema = z.object({
  placeId: z.string(),
  name: z.string().nullable(),
})
export type RouteStopResult = z.infer<typeof routeStopResultSchema>

/**
 * The explorer's own progress on a route (`RouteProgressSummaryResult`),
 * used both embedded as `RouteDetailResult.MyProgress` and as a row of
 * `GET /routes/progress` (not consumed by this slice — reserved for a
 * later routes-page work unit).
 */
export const routeProgressSummaryResultSchema = z.object({
  routeProgressId: z.string(),
  routeId: z.string(),
  routeName: z.string().nullable(),
  status: z.string(),
  startedAtUtc: z.string(),
  expiresAtUtc: z.string(),
  completedAtUtc: z.string().nullable(),
  completedStopCount: z.number().int(),
  totalStopCount: z.number().int(),
})
export type RouteProgressSummaryResult = z.infer<typeof routeProgressSummaryResultSchema>

/** `GET /routes/{id}` response (`RouteDetailResult`). `myProgress` is `null` when the explorer never started this route. */
export const routeDetailResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  routeType: z.string(),
  theme: z.string(),
  windowDays: z.number().int(),
  completionPointsReward: z.number().int(),
  stops: z.array(routeStopResultSchema),
  myProgress: routeProgressSummaryResultSchema.nullable(),
})
export type RouteDetailResult = z.infer<typeof routeDetailResultSchema>

/** Stop of `RouteProgressDetailResult.Stops` (`RouteProgressStopResult`) — from the intent's `RequiredPlaceIds` snapshot, never live `Route.PlaceIds`. */
export const routeProgressStopResultSchema = z.object({
  placeId: z.string(),
  name: z.string().nullable(),
  isCompleted: z.boolean(),
  completedAtUtc: z.string().nullable(),
})
export type RouteProgressStopResult = z.infer<typeof routeProgressStopResultSchema>

/**
 * `GET /routes/{id}/progress` response (`RouteProgressDetailResult`) — the
 * explorer's LAST attempt on this route. A `404` means "never started" and
 * is handled by `getRouteProgress` returning `null`, never parsed through
 * this schema (spec "Explorer Progress Detail", Never-started scenario).
 */
export const routeProgressDetailResultSchema = z.object({
  routeProgressId: z.string(),
  routeId: z.string(),
  routeName: z.string().nullable(),
  status: z.string(),
  startedAtUtc: z.string(),
  expiresAtUtc: z.string(),
  completedAtUtc: z.string().nullable(),
  completedStopCount: z.number().int(),
  totalStopCount: z.number().int(),
  stops: z.array(routeProgressStopResultSchema),
})
export type RouteProgressDetailResult = z.infer<typeof routeProgressDetailResultSchema>
