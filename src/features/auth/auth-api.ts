import axios from 'axios'
import type { TFunction } from 'i18next'
import { apiClient } from '@/shared/lib/api-client'
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  loginResponseSchema,
  problemDetailsSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  type ForgotPasswordRequest,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type ResetPasswordRequest,
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

/**
 * `POST /auth/register` — explorer-onboarding-settings PR1. Same shape and
 * transport as `loginRequest`: the response reuses `loginResponseSchema`
 * because the backend returns the same `AuthResponse`, so a successful
 * registration auto-authenticates exactly like login.
 */
export async function registerRequest(payload: RegisterRequest): Promise<LoginResponse> {
  const body = registerRequestSchema.parse(payload)
  const { data } = await apiClient.post('/auth/register', body)
  return loginResponseSchema.parse(data)
}

/**
 * Mapea errores de `POST /auth/register` al copy que ve el usuario (D4).
 * Diverge deliberadamente de `mapLoginError` en un solo punto:
 * `Identity.DuplicateExplorer` SIEMPRE se traduce, nunca pasa el `detail`
 * real del servidor — ese `detail` viene hardcodeado en español desde el
 * backend y rompería el locale `en`.
 *
 *   409 title="Identity.DuplicateExplorer" -> mensaje estático traducido (NUNCA el detail del server)
 *   400 title="Validation.Failed"          -> usa el `detail` real si vino (passthrough, igual que login)
 *   429                                     -> mensaje estático traducido de rate limit
 */
export function mapRegisterError(error: unknown, t: TFunction): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return t('errors.network')
    }

    const problem = problemDetailsSchema.safeParse(error.response.data)
    const title = problem.success ? problem.data.title : undefined
    const detail = problem.success ? problem.data.detail : undefined
    const status = error.response.status

    if (title === 'Identity.DuplicateExplorer') {
      return t('errors.duplicateExplorer')
    }
    if (title === 'Validation.Failed' || status === 400) {
      return detail ?? t('errors.validationFailed')
    }
    if (status === 429) {
      return t('errors.rateLimited')
    }
  }

  return t('errors.generic')
}

/**
 * `POST /auth/password/forgot` — contrato confirmado directamente con el
 * owner del backend. No hay respuesta relevante que parsear: el backend
 * SIEMPRE devuelve 200 OK sin importar si el correo existe (anti
 * account-enumeration), así que esta función no valida ni devuelve un body.
 */
export async function forgotPasswordRequest(payload: ForgotPasswordRequest): Promise<void> {
  const body = forgotPasswordRequestSchema.parse(payload)
  await apiClient.post('/auth/password/forgot', body)
}

/**
 * Mapea errores de `POST /auth/password/forgot`. Al ser un endpoint que
 * siempre responde 200 OK, solo hay ramas de error de transporte/validación
 * cliente-servidor — no existe un título problem+json específico de este
 * endpoint más allá de `Validation.Failed` (ej. formato de correo, aunque zod
 * ya debería atajarlo antes de llegar acá).
 *
 *   429                            -> mensaje estático traducido de rate limit
 *   400 title="Validation.Failed"  -> usa el `detail` real si vino (passthrough, igual que login)
 */
export function mapForgotPasswordError(error: unknown, t: TFunction): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return t('errors.network')
    }

    const problem = problemDetailsSchema.safeParse(error.response.data)
    const title = problem.success ? problem.data.title : undefined
    const detail = problem.success ? problem.data.detail : undefined
    const status = error.response.status

    if (status === 429) {
      return t('errors.rateLimited')
    }
    if (title === 'Validation.Failed' || status === 400) {
      return detail ?? t('errors.validationFailed')
    }
  }

  return t('errors.generic')
}

/**
 * `POST /auth/password/reset` — contrato confirmado directamente con el
 * owner del backend. A diferencia de login/register, esta respuesta 200 OK
 * no trae tokens: el reset de contraseña no auto-autentica, así que no hay
 * un `*ResponseSchema` que parsear acá.
 */
export async function resetPasswordRequest(payload: ResetPasswordRequest): Promise<void> {
  const body = resetPasswordRequestSchema.parse(payload)
  await apiClient.post('/auth/password/reset', body)
}

/**
 * Mapea errores de `POST /auth/password/reset` (contrato confirmado con el
 * backend).
 *
 *   401 title="Identity.InvalidResetToken" -> mensaje estático traducido, NUNCA el detail del server
 *   400 title="Validation.Failed"          -> usa el `detail` real si vino (passthrough, igual que login)
 *   429                                    -> mensaje estático traducido de rate limit
 *
 * El 401 es deliberadamente estático (nunca pasa `detail`): es la misma
 * lógica de seguridad que `Identity.DuplicateExplorer` en `mapRegisterError`
 * — un token de reset inválido/expirado no debería filtrar detalles del
 * servidor al usuario.
 */
export function mapResetPasswordError(error: unknown, t: TFunction): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return t('errors.network')
    }

    const problem = problemDetailsSchema.safeParse(error.response.data)
    const title = problem.success ? problem.data.title : undefined
    const detail = problem.success ? problem.data.detail : undefined
    const status = error.response.status

    if (title === 'Identity.InvalidResetToken' || status === 401) {
      return t('errors.invalidResetToken')
    }
    if (title === 'Validation.Failed' || status === 400) {
      return detail ?? t('errors.validationFailed')
    }
    if (status === 429) {
      return t('errors.rateLimited')
    }
  }

  return t('errors.generic')
}
