import axios from 'axios'
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
 * Mapea errores de `POST /auth/login` al copy en español que ve el usuario.
 * Contrato de errores confirmado contra el backend real: problem+json
 * (RFC7807) vía `Results.Problem` — `{ title, detail, status }`.
 *
 *   401 title="Identity.InvalidCredentials" -> "Credenciales inválidas"
 *   403 title="Identity.AccountLockedOut"    -> usa el `detail` real (tiene info útil)
 *   400 title="Validation.Failed"            -> usa el `detail` real
 *
 * Matchea primero por `title` (más preciso, es el campo semántico de
 * problem+json) y cae al status HTTP como respaldo si el título no vino o
 * no es el esperado.
 */
export function mapLoginError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // Sin respuesta = red caída, backend abajo, o bloqueado por CORS.
      return 'No pudimos conectar con el servidor. Intentá de nuevo.'
    }

    const problem = problemDetailsSchema.safeParse(error.response.data)
    const title = problem.success ? problem.data.title : undefined
    const detail = problem.success ? problem.data.detail : undefined
    const status = error.response.status

    if (title === 'Identity.InvalidCredentials' || status === 401) {
      return 'Credenciales inválidas'
    }
    if (title === 'Identity.AccountLockedOut' || status === 403) {
      return detail ?? 'Tu cuenta está bloqueada temporalmente.'
    }
    if (title === 'Validation.Failed' || status === 400) {
      return detail ?? 'Revisá los datos ingresados.'
    }
  }

  return 'No pudimos iniciar sesión. Intentá de nuevo en unos minutos.'
}
