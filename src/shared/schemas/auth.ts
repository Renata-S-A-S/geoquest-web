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
