/**
 * WU003b (map discovery, PR3) — the demo check-in flow no longer hardcodes
 * a single seed place: `placeId`/`placeName` now come from
 * `checkinStore.selectedPlace`, set by the map's place list
 * (`src/features/map/map-page.tsx`) before navigating to `/checkin`. See
 * `use-checkin.ts` and `checkin-page.tsx`.
 */

/** Captured-photo encoding constraints (design decision #7). */
export const MAX_EDGE_PX = 1600
export const JPEG_QUALITY = 0.85
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
