import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Validación cliente del formulario de restablecer contraseña — mismo
 * patrón factory que `createLoginSchema`/`createRegisterSchema` (zod congela
 * sus mensajes al construir el schema). El `.refine()` de coincidencia de
 * contraseñas replica 1:1 el de `createRegisterSchema`, incluida la reutilización
 * de la clave `validation.passwordMismatch`. `email`/`token` no son campos de
 * este formulario — llegan por query string (`useSearchParams`) y se agregan
 * al payload en la página, no acá.
 */
export function createResetPasswordSchema(t: TFunction) {
  return z
    .object({
      newPassword: z.string().min(8, t('validation.passwordMin')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    })
}

export type ResetPasswordFormValues = z.infer<ReturnType<typeof createResetPasswordSchema>>
