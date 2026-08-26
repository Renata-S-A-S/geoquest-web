import type { Route } from '@/features/routes/schemas'

/**
 * MOCK DISPLAY DATA — pending a backend read endpoint for Routes.
 *
 * The backend (`GeoQuest.Modules.Routes`) currently exposes ONLY write
 * endpoints (`POST /routes/{id}/start`, `/admin/routes/*`) — there is no
 * `GET /routes` or `GET /routes/{id}` yet. Per the founder's explicit
 * decision, this feature ships with hand-authored display data instead of
 * waiting on that backend follow-up.
 *
 * These are NOT fake placeholders: both routes below were actually created
 * end-to-end against the real running backend (`POST /admin/routes`, then
 * `POST /admin/routes/{id}/publish`), using real `PlaceId`s from the 20
 * curated Medellín places seeded in `geo.places` — each place was first
 * flipped to `AllowedInDiscoveryRoutes = true` via
 * `PATCH /admin/places/{id}/routes-eligibility`, or `POST /admin/routes`
 * rejects with `409 Route.IneligiblePlaces`. `id`, `name`, `routeType`,
 * `theme`, `placeIds` order, `windowDays`, and `completionPointsReward`
 * below are an exact mirror of what was actually POSTed and now lives in
 * the `routes` schema of the dev database — tapping "Iniciar ruta" on
 * either card calls the real `POST /routes/{id}/start` against real data.
 *
 * `stops[].name` / `stops[].category` are display-only enrichment (the
 * backend `Route` only carries `placeIds`, bare GUIDs) — sourced from the
 * same 20 curated places (`geo.places`, business
 * `00000000-0000-0000-0000-000000000001`), in the same order as
 * `placeIds`. Remove this file's `stops` field (and reconcile the rest
 * against a live payload) once a real `GET /routes` / `GET /routes/{id}`
 * exists.
 */
export interface RouteStopDisplay {
  placeId: string
  name: string
  /** One of `CATEGORY_BY_ID` (`shared/schemas/places.ts`) — reuses the `gamification:interests.*` i18n keys. */
  category: string
}

export type RouteDisplay = Route & { stops: RouteStopDisplay[] }

export const MOCK_ROUTES: RouteDisplay[] = [
  {
    id: '957a81ac-0506-48e1-9b24-c37752557e39',
    name: 'Centro histórico de Medellín',
    routeType: 'Recorrido a pie',
    theme: 'Centro histórico',
    placeIds: [
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000020',
    ],
    windowDays: 5,
    completionPointsReward: 500,
    completionBadgeId: null,
    contentVersion: 1,
    status: 'Published',
    createdAtUtc: '2026-08-26T02:15:54.669Z',
    stops: [
      { placeId: '10000000-0000-0000-0000-000000000001', name: 'Plaza Botero', category: 'Arte' },
      {
        placeId: '10000000-0000-0000-0000-000000000002',
        name: 'Museo de Antioquia',
        category: 'HistoriaCultura',
      },
      {
        placeId: '10000000-0000-0000-0000-000000000003',
        name: 'Catedral Metropolitana de Medellín',
        category: 'HistoriaCultura',
      },
      {
        placeId: '10000000-0000-0000-0000-000000000010',
        name: 'Palacio de la Cultura',
        category: 'HistoriaCultura',
      },
      {
        placeId: '10000000-0000-0000-0000-000000000020',
        name: 'Plaza Minorista José María Villa',
        category: 'Gastronomia',
      },
    ],
  },
  {
    id: '1a7d8846-7cc4-4b55-ac70-5af5fb3f0e73',
    name: 'Naturaleza y ciencia',
    routeType: 'Recorrido a pie',
    theme: 'Aire libre y descubrimiento',
    placeIds: [
      '10000000-0000-0000-0000-000000000008',
      '10000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000014',
      '10000000-0000-0000-0000-000000000004',
    ],
    windowDays: 7,
    completionPointsReward: 400,
    completionBadgeId: null,
    contentVersion: 1,
    status: 'Published',
    createdAtUtc: '2026-08-26T02:15:18.753Z',
    stops: [
      {
        placeId: '10000000-0000-0000-0000-000000000008',
        name: 'Jardín Botánico',
        category: 'Naturaleza',
      },
      {
        placeId: '10000000-0000-0000-0000-000000000006',
        name: 'Parque Explora',
        category: 'HistoriaCultura',
      },
      {
        placeId: '10000000-0000-0000-0000-000000000014',
        name: 'Planetario de Medellín',
        category: 'HistoriaCultura',
      },
      {
        placeId: '10000000-0000-0000-0000-000000000004',
        name: 'Parque de los Deseos',
        category: 'HistoriaCultura',
      },
    ],
  },
]
