import { z } from 'zod'

/**
 * Contrato REAL de `POST /auth/login`, confirmado contra el código fuente
 * del backend (Renata-S-A-S/geoquest, `GeoQuest.Modules.Identity/Api`) —
 * WU6, issue #6. No inventar campos: si el backend cambia, este archivo
 * cambia junto con él.
 */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAtUtc: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAtUtc: z.string(),
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

/**
 * Contrato REAL de `POST /auth/register` — explorer-onboarding-settings PR1.
 * `latitude`/`longitude` son opcionales (D3: captura GPS no bloqueante). La
 * respuesta reutiliza `loginResponseSchema` sin cambios: el backend devuelve
 * el mismo `AuthResponse` que login, así el registro auto-autentica.
 */
export const registerRequestSchema = z.object({
  username: z.string().min(1).max(64),
  email: z.string().email().max(256),
  password: z.string().min(8),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

/**
 * Contrato REAL de `POST /auth/refresh` — WU6 (issue #6). El body key
 * (`refreshToken`) fue confirmado contra el código fuente del backend. La
 * respuesta reutiliza `loginResponseSchema` (misma forma exacta que login).
 */
export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
})
export type RefreshRequest = z.infer<typeof refreshRequestSchema>

/**
 * Contrato REAL de `POST /auth/password/forgot`, confirmado directamente con
 * el owner del backend. Siempre responde 200 OK sin body relevante — es
 * deliberado (anti account-enumeration), así que el frontend NUNCA debe leer
 * esa respuesta como "el correo existe" ni "el email se entregó", solo como
 * "la solicitud se procesó". No inventar campos de respuesta.
 */
export const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
})
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>

/**
 * Contrato REAL de `POST /auth/password/reset`, confirmado directamente con
 * el owner del backend. El `token` viaja tal cual llegó en el link del email
 * (`{FrontendBaseUrl}{ResetPath}?email={email}&token={token}`) — es base64 y
 * puede contener `+`/`/`, por eso nunca se parsea a mano, solo vía
 * `URLSearchParams`/`useSearchParams`. `newPassword` usa el mismo mínimo que
 * `registerRequestSchema.password` (8 caracteres) — no hay motivo para que el
 * backend acepte reglas distintas entre alta y reset de contraseña.
 */
export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  newPassword: z.string().min(8),
})
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>

/**
 * Forma problem+json (RFC7807) que devuelve ASP.NET `Results.Problem` en los
 * errores de login. Todos los campos opcionales porque no todas las
 * respuestas de error los incluyen siempre.
 */
export const problemDetailsSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().optional(),
})
export type ProblemDetails = z.infer<typeof problemDetailsSchema>
