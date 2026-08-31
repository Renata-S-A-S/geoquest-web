import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Patrón de username del backend real (`^[A-Za-z0-9_]{3,20}$`) — letras,
 * números o guion bajo, 3 a 20 caracteres. Al ser una franja más estricta
 * que el límite de 64 caracteres del contrato de API (`registerRequestSchema`
 * en `shared/schemas/auth.ts`), cualquier string que pase este regex ya
 * cumple ese límite: no hace falta un `.max(64)` redundante acá.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

/**
 * Validación cliente del formulario de registro — mismo patrón factory que
 * `createLoginSchema` (WU11 PR2, auth i18n migration): zod congela sus
 * mensajes al construir el schema, así que una instancia estática nunca
 * podría re-traducirse en un cambio de idioma. Los callers reconstruyen el
 * schema con el `t` vigente en cada render.
 */
export function createRegisterSchema(t: TFunction) {
  return z
    .object({
      email: z.string().email(t('validation.emailInvalid')).max(256, t('validation.emailInvalid')),
      username: z.string().regex(USERNAME_PATTERN, t('validation.usernameInvalid')),
      password: z.string().min(8, t('validation.passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    })
}

export type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>
