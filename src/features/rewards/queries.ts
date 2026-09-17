import { useQuery } from '@tanstack/react-query'
import { getRewards } from '@/features/rewards/rewards-api'

/**
 * Rewards — TanStack Query wiring around `rewards-api.ts`. Mirrors
 * `features/routes/queries.ts`.
 *
 * `list` has no parameters because `GET /rewards` takes none: it is
 * anonymous and unfiltered beyond the backend's Published + Active
 * business rule, so one cache entry serves every explorer.
 */
export const rewardsKeys = {
  list: ['rewards', 'list'] as const,
}

/** `GET /rewards` — the published reward catalog (its UI consumer arrives in the next work unit). */
export function useRewards() {
  return useQuery({
    queryKey: rewardsKeys.list,
    queryFn: getRewards,
  })
}
