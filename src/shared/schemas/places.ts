import { z } from 'zod'

/**
 * `GET /places/nearby` contract — WU003b (map discovery). Mirrors
 * `schemas/gamification.ts`: Zod parse in, Zod parse out. Field names
 * confirmed against `GeoQuest.Modules.Geo/Contracts/NearbyPlaceResult.cs`.
 *
 * `category`/`subcategory` are raw numeric enum IDs on the wire here — CONFIRMED
 * via two live `curl GET /places/nearby` calls against the running backend
 * (e.g. `"category":4,"subcategory":17`), NOT string names. This is
 * DIFFERENT from `GET /explorers/me`'s `interests` field, which DOES
 * serialize as string names (`categorySchema` in `schemas/gamification.ts`,
 * via `CategoryCollectionJsonConverter`, backend issues #47/#48). Same
 * `Category` C# enum, two different wire representations depending on the
 * endpoint (design doc decision #9) — the frontend adapts with local lookup
 * tables, display-only, never sent back to the server.
 */
export const nearbyPlaceSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.number().int().min(0).max(5),
  subcategory: z.number().int().min(0).max(19),
  latitude: z.number(),
  longitude: z.number(),
  distanceMeters: z.number(),
  pointsReward: z.number(),
  /** Seed data today is placeholder MinIO URLs (`http://localhost:9000/...`)
   * that mostly don't resolve to a real object yet — consumers must render a
   * graceful fallback on load failure, never assume the first URL is real. */
  photos: z.array(z.string()).default([]),
})
export type NearbyPlace = z.infer<typeof nearbyPlaceSchema>

/** `GET /places/nearby` response body — a bare array, no envelope. */
export const nearbyPlacesSchema = z.array(nearbyPlaceSchema)

/**
 * `Category.cs` (`SharedKernel.Domain.Taxonomy`) — index = C# enum int
 * value. Exact order confirmed against backend source and cross-checked
 * against live HTTP responses (design doc, "Confirmed backend enum order").
 */
export const CATEGORY_BY_ID = [
  'Gastronomia',
  'Naturaleza',
  'HistoriaCultura',
  'Aventura',
  'Arte',
  'Alojamiento',
] as const

/**
 * `Subcategory.cs` (`SharedKernel.Domain.Taxonomy`) — 20 values, index = C#
 * enum int value. Grouped by parent category in comments for readability
 * only; the array itself is flat and index-addressed.
 */
export const SUBCATEGORY_BY_ID = [
  'Restaurant',
  'Cafe',
  'Bar',
  'FoodMarket', // 0-3  Category.Gastronomia
  'Park',
  'Viewpoint',
  'Trail',
  'Beach', // 4-7  Category.Naturaleza
  'Museum',
  'Monument',
  'HistoricSite',
  'CulturalCenter', // 8-11 Category.HistoriaCultura
  'AdventureActivity',
  'CableCar',
  'Sports', // 12-14 Category.Aventura
  'StreetArt',
  'Gallery',
  'PublicArt', // 15-17 Category.Arte
  'Hotel',
  'Hostel', // 18-19 Category.Alojamiento
] as const

/** i18n key suffix for a place's category label — reuses `gamification:interests.*`. */
export function categoryLabelKey(id: number): string {
  return CATEGORY_BY_ID[id]
}

/** i18n key suffix for a place's subcategory — not rendered in UI this slice (design decision, see design doc). */
export function subcategoryLabelKey(id: number): string {
  return SUBCATEGORY_BY_ID[id]
}
