import { QueryClient } from '@tanstack/react-query'

/**
 * Singleton compartido, fuera del árbol de React — mismo motivo que
 * `auth-store.ts` vive en `shared/`: el interceptor de auth
 * (`auth-interceptor.ts`) necesita limpiar la cache en el logout forzado
 * (401 con refresh fallido) sin poder usar `useQueryClient()`, que solo
 * resuelve dentro de un `QueryClientProvider`. `app/providers.tsx` consume
 * esta misma instancia — nunca crear una segunda.
 */
export const queryClient = new QueryClient()
