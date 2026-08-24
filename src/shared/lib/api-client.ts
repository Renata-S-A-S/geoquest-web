import axios from 'axios'
import { installAuthInterceptors } from '@/shared/lib/auth-interceptor'

/**
 * Cliente Axios — WU6 (issue #6). Bearer token attachment y 401
 * refresh-and-retry viven en `auth-interceptor.ts`.
 *
 * Fallback de dev: en un deploy real, `VITE_API_BASE_URL` se configura como
 * variable de entorno real (`.env.local` / CI). No pudimos escribir un
 * `.env.local` en este repo durante WU6 (bloqueado por permisos de archivo),
 * así que este fallback apunta al backend local de desarrollo — nunca debe
 * depender de esto un build de producción real.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5219',
})

installAuthInterceptors(apiClient)
