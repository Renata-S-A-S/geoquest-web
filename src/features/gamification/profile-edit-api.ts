import axios from 'axios'
import type { TFunction } from 'i18next'
import { apiClient } from '@/shared/lib/api-client'
import { problemDetailsSchema } from '@/shared/schemas/auth'
import {
  explorerProfileResponseSchema,
  type ExplorerProfileResponse,
  type ProfilePatchInput,
} from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — `/explorers/me` transport (GET + PATCH). Mirrors
 * `checkin-api.ts`'s pattern (Zod parse out + `map*Error`), but the PATCH
 * request body is built by a PURE function (design decision #4) so the
 * avatar/removeAvatar XOR is unit-testable without a real request.
 */

/** `GET /explorers/me` — no bespoke error taxonomy, caller decides (WU10c design decision D1). */
export async function getExplorerProfile(): Promise<ExplorerProfileResponse> {
  const { data } = await apiClient.get('/explorers/me')
  return explorerProfileResponseSchema.parse(data)
}

/**
 * Builds the multipart body for `PATCH /explorers/me`. Field names confirmed
 * against `ExplorersEndpoints` (`username`, `interests` — repeated, one
 * entry per value — `avatar`, `removeAvatar`). `username`/`interests` are
 * appended only when present (omitted key = "do not touch", matching the
 * backend's `interestsProvided` distinction); `avatarChange` is a
 * discriminated union so `avatar` and `removeAvatar` can never both be
 * appended. No manual `Content-Type` — axios sets the multipart boundary
 * from the `FormData` instance (same as `uploadCheckinPhoto`).
 */
export function buildProfilePatchForm(input: ProfilePatchInput): FormData {
  const form = new FormData()

  if (input.username !== undefined) {
    form.append('username', input.username)
  }

  if (input.interests !== undefined) {
    for (const interest of input.interests) {
      form.append('interests', interest)
    }
  }

  switch (input.avatarChange.kind) {
    case 'replace':
      form.append('avatar', input.avatarChange.file)
      break
    case 'remove':
      form.append('removeAvatar', 'true')
      break
    case 'none':
      break
  }

  return form
}

/** `PATCH /explorers/me`. */
export async function updateExplorerProfile(
  input: ProfilePatchInput
): Promise<ExplorerProfileResponse> {
  const form = buildProfilePatchForm(input)
  const { data } = await apiClient.patch('/explorers/me', form)
  return explorerProfileResponseSchema.parse(data)
}

/**
 * The 8 error codes `PATCH /explorers/me` can return (confirmed against
 * backend source: `UpdateExplorerProfileCommandValidator`,
 * `UpdateExplorerProfileCommandHandler`, `Domain/Explorer.cs`,
 * `MinIoAvatarStorage`). `ExplorersEndpoints.ToProblem` sets the problem+json
 * `title` to the error code directly (no prefix, unlike check-in's
 * `CreateCheckInCommand.` titles).
 */
export type ProfilePatchErrorCode =
  | 'Validation.Failed'
  | 'ExplorerProfile.NotFound'
  | 'ExplorerProfile.DuplicateUsername'
  | 'Explorer.InvalidUsernameFormat'
  | 'Explorer.ProfaneUsername'
  | 'Explorer.UsernameChangeCooldownActive'
  | 'Explorer.InvalidInterestsCount'
  | 'AvatarUpload.TooLarge'

const KNOWN_CODES: readonly ProfilePatchErrorCode[] = [
  'Validation.Failed',
  'ExplorerProfile.NotFound',
  'ExplorerProfile.DuplicateUsername',
  'Explorer.InvalidUsernameFormat',
  'Explorer.ProfaneUsername',
  'Explorer.UsernameChangeCooldownActive',
  'Explorer.InvalidInterestsCount',
  'AvatarUpload.TooLarge',
]

export interface ProfilePatchError {
  code: ProfilePatchErrorCode | 'Unknown'
  message: string
}

/**
 * Maps `PATCH /explorers/me` errors, translated via `t` (namespace
 * `gamification`, WU11 PR4c — mirrors `mapLoginError`'s factory-call
 * pattern). Unlike `mapCreateCheckinError`, the `title` IS the error code
 * (no prefix to strip). The server `detail` already carries the exact
 * user-facing message (e.g. the cooldown error includes the precomputed
 * remaining-days count) in whatever language the backend returns it — that
 * passthrough stays untouched, only the static fallback strings are
 * translated.
 */
export function mapProfilePatchError(error: unknown, t: TFunction): ProfilePatchError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return { code: 'Unknown', message: t('errors.network') }
    }

    const problem = problemDetailsSchema.safeParse(error.response.data)
    const title = problem.success ? problem.data.title : undefined
    const detail = problem.success ? problem.data.detail : undefined
    const code = title && (KNOWN_CODES as readonly string[]).includes(title) ? title : 'Unknown'

    return {
      code: code as ProfilePatchErrorCode | 'Unknown',
      message: detail ?? t('errors.generic'),
    }
  }

  return { code: 'Unknown', message: t('errors.generic') }
}
