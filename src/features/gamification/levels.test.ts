import { describe, expect, it } from 'vitest'
import { LEVEL_THRESHOLDS, levelProgress } from '@/features/gamification/levels'

/**
 * WU10 (gamification), design decision #11 / Design Risks R3 — thresholds
 * transcribed from `GeoQuest.Modules.Gaming/Domain/Level.cs`'s `<remarks>`
 * (T119/`LevelRule` not yet implemented server-side; this pins the
 * documented intent so a future edit here is deliberate and reviewed).
 */

describe('LEVEL_THRESHOLDS', () => {
  it('is pinned to the exact documented ladder', () => {
    expect(LEVEL_THRESHOLDS).toEqual([
      { level: 'Explorer', minXP: 0 },
      { level: 'Traveler', minXP: 500 },
      { level: 'Adventurer', minXP: 1500 },
      { level: 'Wanderer', minXP: 3500 },
      { level: 'Legend', minXP: 7500 },
    ])
  })
})

describe('levelProgress boundaries', () => {
  it('totalXP=0 -> Explorer, fraction 0', () => {
    const p = levelProgress(0)
    expect(p.level).toBe('Explorer')
    expect(p.nextLevel).toBe('Traveler')
    expect(p.xpIntoLevel).toBe(0)
    expect(p.xpForNextLevel).toBe(500)
    expect(p.fraction).toBe(0)
    expect(p.isMax).toBe(false)
  })

  it('totalXP=499 -> still Explorer, just under the Traveler threshold', () => {
    const p = levelProgress(499)
    expect(p.level).toBe('Explorer')
    expect(p.xpIntoLevel).toBe(499)
    expect(p.fraction).toBeCloseTo(499 / 500, 10)
  })

  it('totalXP=500 -> Traveler exactly at the threshold', () => {
    const p = levelProgress(500)
    expect(p.level).toBe('Traveler')
    expect(p.nextLevel).toBe('Adventurer')
    expect(p.xpIntoLevel).toBe(0)
    expect(p.fraction).toBe(0)
  })

  it('totalXP=1499 -> still Traveler', () => {
    const p = levelProgress(1499)
    expect(p.level).toBe('Traveler')
    expect(p.xpIntoLevel).toBe(999)
    expect(p.xpForNextLevel).toBe(1000)
    expect(p.fraction).toBeCloseTo(999 / 1000, 10)
  })

  it('totalXP=1500 -> Adventurer exactly at the threshold', () => {
    const p = levelProgress(1500)
    expect(p.level).toBe('Adventurer')
    expect(p.nextLevel).toBe('Wanderer')
    expect(p.xpIntoLevel).toBe(0)
  })

  it('totalXP=3499 -> still Adventurer', () => {
    const p = levelProgress(3499)
    expect(p.level).toBe('Adventurer')
    expect(p.xpIntoLevel).toBe(1999)
    expect(p.xpForNextLevel).toBe(2000)
  })

  it('totalXP=3500 -> Wanderer exactly at the threshold', () => {
    const p = levelProgress(3500)
    expect(p.level).toBe('Wanderer')
    expect(p.nextLevel).toBe('Legend')
    expect(p.xpIntoLevel).toBe(0)
  })

  it('totalXP=7499 -> still Wanderer, just under Legend', () => {
    const p = levelProgress(7499)
    expect(p.level).toBe('Wanderer')
    expect(p.xpIntoLevel).toBe(3999)
    expect(p.xpForNextLevel).toBe(4000)
    expect(p.isMax).toBe(false)
  })

  it('totalXP=7500 -> Legend, exactly at max', () => {
    const p = levelProgress(7500)
    expect(p.level).toBe('Legend')
    expect(p.nextLevel).toBeNull()
    expect(p.nextThreshold).toBeNull()
    expect(p.xpForNextLevel).toBeNull()
    expect(p.fraction).toBe(1)
    expect(p.isMax).toBe(true)
  })

  it('totalXP=12000 -> still Legend, far past max', () => {
    const p = levelProgress(12000)
    expect(p.level).toBe('Legend')
    expect(p.nextLevel).toBeNull()
    expect(p.fraction).toBe(1)
    expect(p.isMax).toBe(true)
  })

  it('negative totalXP clamps to 0 -> Explorer', () => {
    const p = levelProgress(-50)
    expect(p.level).toBe('Explorer')
    expect(p.xpIntoLevel).toBe(0)
    expect(p.fraction).toBe(0)
  })

  it('NaN totalXP clamps to 0 -> Explorer', () => {
    const p = levelProgress(NaN)
    expect(p.level).toBe('Explorer')
    expect(p.xpIntoLevel).toBe(0)
    expect(p.fraction).toBe(0)
  })
})
