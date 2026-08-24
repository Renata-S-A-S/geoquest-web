/**
 * WU10 (gamification), design decision #10 / Design Risks R1b — pure
 * 30-day cooldown mirror of `Domain/Explorer.cs`'s
 * `UsernameChangeCooldownDays` + `ChangeUsername`. The server remains
 * authority (`Explorer.UsernameChangeCooldownActive` is still mapped by
 * `mapProfilePatchError` on submit); this only drives a proactive UI hint.
 * A `null` `usernameChangedAt` (never changed) is treated as unlocked.
 */
const COOLDOWN_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface UsernameCooldownResult {
  locked: boolean
  daysRemaining: number
}

export function usernameCooldown(
  usernameChangedAt: string | null,
  now: Date = new Date()
): UsernameCooldownResult {
  if (!usernameChangedAt) {
    return { locked: false, daysRemaining: 0 }
  }

  const elapsedDays = (now.getTime() - new Date(usernameChangedAt).getTime()) / MS_PER_DAY

  if (elapsedDays >= COOLDOWN_DAYS) {
    return { locked: false, daysRemaining: 0 }
  }

  return { locked: true, daysRemaining: Math.ceil(COOLDOWN_DAYS - elapsedDays) }
}
