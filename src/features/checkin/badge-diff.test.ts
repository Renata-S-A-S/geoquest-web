import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  badgeNames,
  diffUnlockedBadges,
  warnBadgeDiffDegraded,
} from '@/features/checkin/badge-diff'
import type { BadgeAward } from '@/shared/schemas/gamification'

const CHECKIN_CREATED_AT = '2026-09-17T12:00:00Z'

/**
 * The diff reads only `name` and `awardedAtUtc`; `description` and `iconUrl`
 * are here so the fixture stays a real `BadgeAward` (issue #153), not because
 * this module cares about them.
 */
function badge(name: string, awardedAtUtc: string): BadgeAward {
  return { name, description: `Insignia ${name}.`, iconUrl: null, awardedAtUtc }
}

describe('badgeNames', () => {
  it('projects a badge list down to its names, in order', () => {
    expect(
      badgeNames([
        badge('Primer paso', '2026-01-01T00:00:00Z'),
        badge('Explorador', '2026-02-01T00:00:00Z'),
      ])
    ).toEqual(['Primer paso', 'Explorador'])
  })

  it('maps an explorer with no badges to an empty list', () => {
    expect(badgeNames([])).toEqual([])
  })
})

describe('diffUnlockedBadges', () => {
  // Issue #154 — a missing snapshot used to mean "claim nothing", which made
  // the celebration structurally unreachable on the only path a first-time
  // explorer walks (map -> place -> check-in never fills the profile cache).
  // It now means "trust the timestamp alone".
  it('falls back to the timestamp test alone when there is no before snapshot', () => {
    const after = [badge('Explorador', '2026-09-17T12:00:05Z')]

    expect(diffUnlockedBadges(null, after, CHECKIN_CREATED_AT)).toEqual(['Explorador'])
  })

  it('discards a badge awarded before the check-in when there is no before snapshot', () => {
    const after = [badge('Veterano', '2026-09-17T11:59:59Z')]

    expect(diffUnlockedBadges(null, after, CHECKIN_CREATED_AT)).toEqual([])
  })

  it('keeps the at-or-after boundary when there is no before snapshot', () => {
    const after = [
      badge('Veterano', '2026-01-01T00:00:00Z'),
      badge('Explorador', CHECKIN_CREATED_AT),
    ]

    expect(diffUnlockedBadges(null, after, CHECKIN_CREATED_AT)).toEqual(['Explorador'])
  })

  it('returns the names that appeared after the check-in was created', () => {
    const after = [
      badge('Primer paso', '2026-01-01T00:00:00Z'),
      badge('Explorador', '2026-09-17T12:00:05Z'),
    ]

    expect(diffUnlockedBadges(['Primer paso'], after, CHECKIN_CREATED_AT)).toEqual(['Explorador'])
  })

  it('treats an explorer who owned no badges at all as a valid snapshot, not a missing one', () => {
    const after = [badge('Primer paso', '2026-09-17T12:00:05Z')]

    expect(diffUnlockedBadges([], after, CHECKIN_CREATED_AT)).toEqual(['Primer paso'])
  })

  it('discards a badge awarded strictly before the check-in even when it is missing from the snapshot', () => {
    // A stale snapshot (or a badge earned on another device) must never be
    // claimed by this check-in.
    const after = [badge('Veterano', '2026-09-17T11:59:59Z')]

    expect(diffUnlockedBadges([], after, CHECKIN_CREATED_AT)).toEqual([])
  })

  it('counts a badge awarded at exactly the check-in timestamp as unlocked by it', () => {
    // Boundary: at-or-after, not strictly-after. The backend stamps
    // CreatedAt and AwardedAtUtc inside the same check-in processing, so an
    // identical timestamp is the expected case, not a coincidence.
    const after = [badge('Explorador', CHECKIN_CREATED_AT)]

    expect(diffUnlockedBadges([], after, CHECKIN_CREATED_AT)).toEqual(['Explorador'])
  })

  it('returns an empty list when nothing new was awarded', () => {
    const after = [badge('Primer paso', '2026-01-01T00:00:00Z')]

    expect(diffUnlockedBadges(['Primer paso'], after, CHECKIN_CREATED_AT)).toEqual([])
  })

  it('discards a name already present in the snapshot even if its award date is recent', () => {
    const after = [badge('Primer paso', '2026-09-17T12:00:05Z')]

    expect(diffUnlockedBadges(['Primer paso'], after, CHECKIN_CREATED_AT)).toEqual([])
  })

  it('compares an offset-less .NET DateTime as UTC on both sides', () => {
    // `CheckInStatusResult.CreatedAt` and `BadgeAwardResult.AwardedAtUtc`
    // are both `DateTime`, so System.Text.Json can serialize them without a
    // trailing `Z`. Parsing one as UTC and the other as local time would
    // shift the comparison by the runner's timezone offset.
    const after = [badge('Explorador', '2026-09-17T12:00:05')]

    expect(diffUnlockedBadges([], after, '2026-09-17T12:00:00')).toEqual(['Explorador'])
    expect(diffUnlockedBadges([], after, '2026-09-17T12:00:00Z')).toEqual(['Explorador'])
  })

  it('discards a badge whose award timestamp cannot be parsed', () => {
    const after = [badge('Explorador', 'not-a-date')]

    expect(diffUnlockedBadges([], after, CHECKIN_CREATED_AT)).toEqual([])
  })

  it('returns an empty list when the check-in timestamp cannot be parsed', () => {
    const after = [badge('Explorador', '2026-09-17T12:00:05Z')]

    expect(diffUnlockedBadges([], after, 'not-a-date')).toEqual([])
  })

  it('returns every newly awarded name, preserving the profile order', () => {
    const after = [
      badge('Explorador', '2026-09-17T12:00:05Z'),
      badge('Primer paso', '2026-01-01T00:00:00Z'),
      badge('Fotografo', '2026-09-17T12:00:06Z'),
    ]

    expect(diffUnlockedBadges(['Primer paso'], after, CHECKIN_CREATED_AT)).toEqual([
      'Explorador',
      'Fotografo',
    ])
  })
})

/**
 * Issue #154, point 4 — every degradation used to land on the same empty
 * badge line, which is exactly what kept this invisible for a day. These
 * two causes are different problems and must read differently.
 */
describe('warnBadgeDiffDegraded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('names a missing snapshot as the reason the diff ran without a baseline', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    warnBadgeDiffDegraded('snapshot-missing')

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/snapshot/i)
  })

  it('names a failed profile read distinctly from a missing snapshot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    warnBadgeDiffDegraded('snapshot-missing')
    warnBadgeDiffDegraded('profile-unavailable')

    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[1][0]).toMatch(/profile/i)
    expect(warn.mock.calls[1][0]).not.toBe(warn.mock.calls[0][0])
  })

  it('stays silent outside development so a production build never logs it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('DEV', false)

    warnBadgeDiffDegraded('snapshot-missing')
    warnBadgeDiffDegraded('profile-unavailable')

    expect(warn).not.toHaveBeenCalled()
  })
})
