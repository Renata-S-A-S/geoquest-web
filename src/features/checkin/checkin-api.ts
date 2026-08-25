import axios from 'axios'
import i18next from 'i18next'
import { apiClient } from '@/shared/lib/api-client'
import { problemDetailsSchema } from '@/shared/schemas/auth'
import {
  checkinStatusSchema,
  createCheckinRequestSchema,
  createCheckinResponseSchema,
  photoUploadResponseSchema,
  type CheckinStatus,
  type CreateCheckinRequest,
} from '@/shared/schemas/checkin'

/**
 * WU9 (issue #9) — check-in transport. Mirrors `auth-api.ts`: Zod parse in,
 * Zod parse out, plus a `map*Error` function. Calls go through the shared
 * `apiClient` singleton (WU6 interceptors reused, no second axios instance).
 */

/**
 * `POST /checkins/photo`. The backend binds `IFormFile file`, so the
 * multipart field name MUST be exactly `file` — no manual `Content-Type`,
 * axios sets the multipart boundary from the `FormData` instance.
 */
export async function uploadCheckinPhoto(photo: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', photo, 'checkin.jpg')
  const { data } = await apiClient.post('/checkins/photo', form)
  return photoUploadResponseSchema.parse(data).photoUrl
}

/**
 * `POST /checkins`. `gpsContextData` is intentionally NOT sent (design
 * decision — see design doc "Interfaces / Contracts").
 */
export async function createCheckin(payload: CreateCheckinRequest): Promise<string> {
  const body = createCheckinRequestSchema.parse(payload)
  const { data } = await apiClient.post('/checkins', body)
  return createCheckinResponseSchema.parse(data).checkInId
}

/** `GET /checkins/{id}`. A 404/network error rejects — caller decides how to surface it. */
export async function getCheckinStatus(checkInId: string): Promise<CheckinStatus> {
  const { data } = await apiClient.get(`/checkins/${checkInId}`)
  return checkinStatusSchema.parse(data)
}

export type CheckinRuleRejection =
  'OutOfRadius' | 'HardBlock24Hours' | 'PlaceInactive' | 'GpsAccuracyExceeded' | 'PlaceNotFound'

const RULE_TITLES: readonly CheckinRuleRejection[] = [
  'OutOfRadius',
  'HardBlock24Hours',
  'PlaceInactive',
  'GpsAccuracyExceeded',
  'PlaceNotFound',
]

export type CreateCheckinError = { rule: CheckinRuleRejection } | { message: string }

/**
 * Maps `POST /checkins` errors. Business-rule rejections arrive synchronously
 * as a 400 problem+json whose `title` carries the rule name prefixed by
 * `CreateCheckInCommand.` (design doc "Interfaces / Contracts"). Any other
 * 400, unknown title, or network failure falls back to a generic message —
 * never the AI/content moderation copy, which is reserved for the async
 * poll path (design decision #5, discriminate by transport).
 *
 * The static fallback strings below read from the global `i18next` singleton
 * (WU11 i18n migration) rather than a hook, since this is a plain function
 * with no React context — same "non-React caller" pattern as
 * `locale.ts`'s `getActiveLocale()`. `detail` (server free text) is passed
 * through verbatim and is intentionally out of scope for translation.
 */
export function mapCreateCheckinError(error: unknown): CreateCheckinError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return { message: i18next.t('errors.network', { ns: 'checkin' }) }
    }

    const problem = problemDetailsSchema.safeParse(error.response.data)
    const rawTitle = problem.success ? problem.data.title : undefined
    const rule = rawTitle?.replace(/^CreateCheckInCommand\./, '')

    if (rule && (RULE_TITLES as readonly string[]).includes(rule)) {
      return { rule: rule as CheckinRuleRejection }
    }

    const detail = problem.success ? problem.data.detail : undefined
    return { message: detail ?? i18next.t('errors.unprocessable', { ns: 'checkin' }) }
  }

  return { message: i18next.t('errors.unexpected', { ns: 'checkin' }) }
}
