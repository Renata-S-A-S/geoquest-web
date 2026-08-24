import { z } from 'zod'

/**
 * Check-in contracts — WU9 (issue #9). Mirrors the shape and style of
 * `schemas/auth.ts`: Zod parse in, Zod parse out. Field names and
 * nullability confirmed against the backend source
 * (`GeoQuest.Modules.Geo/Contracts/CheckInStatusResult.cs`): only
 * `rejectionReason` is nullable (`string?`). `awardStatus`, `xpAwarded`,
 * and `geoPointsAwarded` are never null — they default to
 * `NotAwarded`/`0` while a check-in is still pending.
 */

/** `POST /checkins/photo` response. */
export const photoUploadResponseSchema = z.object({
  photoUrl: z.string(),
})
export type PhotoUploadResponse = z.infer<typeof photoUploadResponseSchema>

/**
 * `POST /checkins` request. `gpsContextData` is intentionally NOT part of
 * this shape (design decision — see design doc "Interfaces / Contracts").
 */
export const createCheckinRequestSchema = z.object({
  placeId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  gpsAccuracyMeters: z.number(),
  photoUrl: z.string(),
})
export type CreateCheckinRequest = z.infer<typeof createCheckinRequestSchema>

/** `POST /checkins` response (202 Accepted). */
export const createCheckinResponseSchema = z.object({
  checkInId: z.string(),
})
export type CreateCheckinResponse = z.infer<typeof createCheckinResponseSchema>

/**
 * `validationStatus` classifier — design doc: `0 -> continue polling`,
 * `1 -> pending-review`, `2 -> approved`, `3 -> rejected-content`.
 */
export const ValidationStatus = {
  Pending: 0,
  PendingManualReview: 1,
  Approved: 2,
  Rejected: 3,
} as const
export type ValidationStatus = (typeof ValidationStatus)[keyof typeof ValidationStatus]

const validationStatusSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])

/** `GET /checkins/{id}` response. */
export const checkinStatusSchema = z.object({
  checkInId: z.string(),
  validationStatus: validationStatusSchema,
  awardStatus: z.number(),
  xpAwarded: z.number(),
  geoPointsAwarded: z.number(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string(),
})
export type CheckinStatus = z.infer<typeof checkinStatusSchema>
