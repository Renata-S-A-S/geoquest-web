import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Validación cliente del formulario de login — WU6 (issue #6). El backend
 * real (`POST /auth/login`) solo acepta correo, no hay lookup por username,
 * así que el campo se valida como email de verdad (antes era un string
 * genérico "usuario o correo", WU8 — corregido acá para ser honestos sobre
 * lo que el backend soporta).
 *
 * Factory function instead of a static top-level schema (WU11 PR2, auth
 * i18n migration): zod bakes its message strings into the schema at
 * construction time, so a static schema built once at module load would
 * freeze its validation copy in whatever language was active on first
 * import — it can never reactively re-translate on language change. Callers
 * rebuild the schema from the current `t` on every render instead.
 */
export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(8, t('validation.passwordMin')),
  })
}

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>
