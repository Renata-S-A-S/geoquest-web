import axios from 'axios'
import type { TFunction } from 'i18next'
import { apiClient } from '@/shared/lib/api-client'
import {
  loginRequestSchema,
  loginResponseSchema,
  problemDetailsSchema,
  type LoginRequest,
  type LoginResponse,
} from '@/shared/schemas/auth'

/** WU6 (issue #6) — llama al `POST /auth/login` real, valida la respuesta con zod. */
export async function loginRequest(payload: LoginRequest): Promise<LoginResponse> {
  const body = loginRequestSchema.parse(payload)
  const { data } = await apiClient.post('/auth/login', body)
  return loginResponseSchema.parse(data)
}

/**
 * Mapea errores de `POST /auth/login` al copy que ve el usuario, traducido
 * vía `t` (namespace `auth`, WU11 PR2). Contrato de errores confirmado
 * contra el backend real: problem+json (RFC7807) vía `Results.Problem` —
 * `{ title, detail, status }`.
 *
 *   401 title="Identity.InvalidCredentials" -> mensaje estático traducido
 *   403 title="Identity.AccountLockedOut"    -> usa el `detail` real si vino (sin traducir — es texto del servidor)
 *   400 title="Validation.Failed"            -> usa el `detail` real si vino (sin traducir — es texto del servidor)
 *
 * Solo las ramas estáticas/fallback pasan por `t()` — el passthrough de
 * `detail` del servidor queda tal cual, fuera de alcance de esta migración.
 *
 * Matchea primero por `title` (más preciso, es el campo semántico de
 * problem+json) y cae al status HTTP como respaldo si el título no vino o
 * no es el esperado.
 */
export function mapLoginError(error: unknown, t: TFunction): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // Sin respuesta = red caída, backend abajo, o bloqueado por CORS.
      return t('errors.network')
    }

    const problem = problemDetailsSchema.safeParse(error.response.data)
    const title = problem.success ? problem.data.title : undefined
    const detail = problem.success ? problem.data.detail : undefined
    const status = error.response.status

    if (title === 'Identity.InvalidCredentials' || status === 401) {
      return t('errors.invalidCredentials')
    }
    if (title === 'Identity.AccountLockedOut' || status === 403) {
      return detail ?? t('errors.accountLocked')
    }
    if (title === 'Validation.Failed' || status === 400) {
      return detail ?? t('errors.validationFailed')
    }
  }

  return t('errors.generic')
}
