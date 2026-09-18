import { apiClient } from '@/shared/lib/api-client'

/**
 * `DELETE /explorers/me` — auth-gated account deletion request (habeas data,
 * Ley 1581). Returns `204 No Content` on success and **another 204** when the
 * explorer is already `PendingDeletion`: the domain method is idempotent and
 * keeps the original `DeletionRequestedAtUtc`, so a repeat request never
 * restarts the grace window and never fails.
 *
 * No `map*Error` helper here, unlike `startRoute`: every failure path (409
 * `Explorer.AlreadyDeleted`, 404, 400) collapses into the same single outcome
 * for the explorer — the account was not deactivated — so there is nothing for
 * a mapper to branch on. The caller renders one inline error, same
 * "caller decides" precedent as `getRoutes`.
 */
export async function requestAccountDeletion(): Promise<void> {
  await apiClient.delete('/explorers/me')
}
