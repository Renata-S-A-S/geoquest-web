import { useMutation } from '@tanstack/react-query'
import { startRoute } from '@/features/routes/routes-api'

/** Rutas — TanStack Query wiring around `routes-api.ts`. Mirrors `features/gamification/queries.ts`. */
export function useStartRoute() {
  return useMutation({
    mutationFn: (routeId: string) => startRoute(routeId),
  })
}
