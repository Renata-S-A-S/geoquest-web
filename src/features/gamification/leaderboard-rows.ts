import type { LeaderboardEntry } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification), design "me ∈ top ? highlight in place : pinned row
 * at list end". `rank` is computed server-side
 * (`LeaderboardEntryResult.Rank`, competition ranking — ties share a
 * number, the next distinct value skips, e.g. 1,1,1,4) — this helper NEVER
 * recomputes it, only decides row identity and pinned-row placement.
 */
export interface LeaderboardRow extends LeaderboardEntry {
  isMe: boolean
  /** True only for the synthetic trailing row when `me` is present but outside `top`. */
  pinned: boolean
}

export function buildLeaderboardRows(
  top: readonly LeaderboardEntry[],
  me: LeaderboardEntry | null
): LeaderboardRow[] {
  const rows: LeaderboardRow[] = top.map((entry) => ({
    ...entry,
    isMe: me !== null && entry.explorerId === me.explorerId,
    pinned: false,
  }))

  if (me && !rows.some((row) => row.isMe)) {
    rows.push({ ...me, isMe: true, pinned: true })
  }

  return rows
}
