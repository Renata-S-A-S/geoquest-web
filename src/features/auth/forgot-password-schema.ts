import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Validación cliente del formulario de "olvidé mi contraseña" — mismo
 * patrón factory que `createLoginSchema` (WU11 PR2, auth i18n migration):
 * zod congela sus mensajes al construir el schema, así que una instancia
 * estática nunca podría re-traducirse en un cambio de idioma. Los callers
 * reconstruyen el schema con el `t` vigente en cada render.
 */
export function createForgotPasswordSchema(t: TFunction) {
  return z.object({
    email: z.string().email(t('validation.emailInvalid')),
  })
}

export type ForgotPasswordFormValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>
