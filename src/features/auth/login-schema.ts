import { z } from 'zod'

/**
 * Validación cliente del formulario de login. Reglas mínimas — el backend (WU6)
 * es quien decide si el usuario/correo y la contraseña realmente existen.
 */
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Ingresá tu usuario o correo'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
