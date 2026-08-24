/**
 * Seed data for the demo check-in flow — WU9 (issue #9). No place-selection
 * route exists yet (see design doc decision on `placeId` in
 * "Technical Approach"), so `placeId` is a fixed constant. Both values are
 * env-overridable so a future backend re-seed needs no code change.
 *
 * `10000000-0000-0000-0000-000000000004` = "El Cielo" — confirmed against
 * the running dev backend's seed data during WU9 design: lat 6.2234 /
 * lng -75.5802, 80m check-in radius. No client-side geofence check exists
 * (design decision #6): the backend's `OutOfRadius` 400 is the single
 * source of truth, this constant only selects *which* place to check into.
 */
export const SEED_PLACE_ID: string =
  import.meta.env.VITE_SEED_PLACE_ID ?? '10000000-0000-0000-0000-000000000004'
export const SEED_PLACE_NAME: string = import.meta.env.VITE_SEED_PLACE_NAME ?? 'El Cielo'

/** Captured-photo encoding constraints (design decision #7). */
export const MAX_EDGE_PX = 1600
export const JPEG_QUALITY = 0.85
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
