import { describe, expect, it } from 'vitest'
import { buildLeaderboardRows } from '@/features/gamification/leaderboard-rows'
import type { LeaderboardEntry } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) PR6 — spec "Weekly Ranked List Rendering" +
 * "Own Rank Highlighted Even Outside Visible List". `rank` itself is
 * computed server-side (`LeaderboardEntryResult.Rank`, competition
 * ranking / `RANK()` semantics — ties share a number, the next distinct
 * value skips, e.g. 1,1,1,4). This helper NEVER recomputes rank; it only
 * decides row identity (`isMe`) and whether `me` needs a synthetic pinned
 * row appended (design "me ∈ top ? highlight in place : pinned row").
 */

function entry(overrides: Partial<LeaderboardEntry> & { explorerId: string }): LeaderboardEntry {
  return {
    rank: 1,
    username: `user-${overrides.explorerId}`,
    avatarUrl: null,
    weeklyXP: 0,
    ...overrides,
  }
}

describe('buildLeaderboardRows', () => {
  it('preserves tied ranks (1,1,1,4) exactly as given by the backend, never recomputing them', () => {
    const top = [
      entry({ explorerId: 'a', rank: 1, weeklyXP: 500 }),
      entry({ explorerId: 'b', rank: 1, weeklyXP: 500 }),
      entry({ explorerId: 'c', rank: 1, weeklyXP: 500 }),
      entry({ explorerId: 'd', rank: 4, weeklyXP: 300 }),
    ]

    const rows = buildLeaderboardRows(top, null)

    expect(rows.map((row) => row.rank)).toEqual([1, 1, 1, 4])
    expect(rows.every((row) => !row.isMe && !row.pinned)).toBe(true)
  })

  it('marks the matching row isMe and does NOT append a pinned duplicate when me is inside top', () => {
    const top = [
      entry({ explorerId: 'a', rank: 1 }),
      entry({ explorerId: 'me-1', rank: 2 }),
      entry({ explorerId: 'c', rank: 3 }),
    ]
    const me = entry({ explorerId: 'me-1', rank: 2 })

    const rows = buildLeaderboardRows(top, me)

    expect(rows).toHaveLength(3)
    expect(rows.find((row) => row.explorerId === 'me-1')).toMatchObject({
      isMe: true,
      pinned: false,
    })
    expect(rows.filter((row) => row.isMe)).toHaveLength(1)
  })

  it('appends a pinned row for me when me is present but outside top', () => {
    const top = [entry({ explorerId: 'a', rank: 1 }), entry({ explorerId: 'b', rank: 2 })]
    const me = entry({ explorerId: 'me-1', rank: 47, weeklyXP: 10 })

    const rows = buildLeaderboardRows(top, me)

    expect(rows).toHaveLength(3)
    const pinned = rows[rows.length - 1]
    expect(pinned).toMatchObject({ explorerId: 'me-1', rank: 47, isMe: true, pinned: true })
  })

  it('appends nothing when me is null', () => {
    const top = [entry({ explorerId: 'a', rank: 1 })]

    const rows = buildLeaderboardRows(top, null)

    expect(rows).toHaveLength(1)
  })

  it('returns only the pinned me row when top is empty but me is present', () => {
    const rows = buildLeaderboardRows([], entry({ explorerId: 'me-1', rank: 1 }))

    expect(rows).toEqual([{ ...entry({ explorerId: 'me-1', rank: 1 }), isMe: true, pinned: true }])
  })

  it('returns an empty array when both top and me are empty/null', () => {
    expect(buildLeaderboardRows([], null)).toEqual([])
  })
})
