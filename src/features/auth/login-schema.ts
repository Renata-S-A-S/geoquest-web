import { z } from 'zod'

/**
 * Validación cliente del formulario de login — WU6 (issue #6). El backend
 * real (`POST /auth/login`) solo acepta correo, no hay lookup por username,
 * así que el campo se valida como email de verdad (antes era un string
 * genérico "usuario o correo", WU8 — corregido acá para ser honestos sobre
 * lo que el backend soporta).
 */
export const loginSchema = z.object({
  email: z.string().email('Ingresá un correo válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
