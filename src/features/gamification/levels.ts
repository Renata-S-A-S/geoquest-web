/**
 * WU10 (gamification), design decision #11 / Design Risks R3 — transcribed
 * from `GeoQuest.Modules.Gaming/Domain/Level.cs` (enum ordinals
 * `Explorer=0 … Legend=4`) and its XML `<remarks>`, which documents the
 * `TotalXP` ladder as `Explorer(0)/Traveler(500)/Adventurer(1500)/
 * Wanderer(3500)/Legend(7500)`. This is the SOLE seam for the level-rule:
 * if backend T119 (`LevelRule`) ships a different ladder, only this file
 * changes. The server's `currentLevel` (enum name) always wins for the
 * displayed level TEXT — this file only drives the progress bar's
 * geometry (reconciliation rule, see design "Interfaces / Contracts").
 */
export const LEVEL_THRESHOLDS = [
  { level: 'Explorer', minXP: 0 },
  { level: 'Traveler', minXP: 500 },
  { level: 'Adventurer', minXP: 1500 },
  { level: 'Wanderer', minXP: 3500 },
  { level: 'Legend', minXP: 7500 },
] as const

export type LevelName = (typeof LEVEL_THRESHOLDS)[number]['level']

export interface LevelProgress {
  level: LevelName
  currentThreshold: number
  nextLevel: LevelName | null
  nextThreshold: number | null
  xpIntoLevel: number
  xpForNextLevel: number | null
  fraction: number
  isMax: boolean
}

/**
 * Picks the highest threshold whose `minXP <= totalXP`. Negative/`NaN`
 * clamps to `0` (Explorer). `fraction` is exactly `1` and `isMax` is `true`
 * at Legend — `nextLevel`/`nextThreshold`/`xpForNextLevel` are `null`, per
 * the design's max-level rendering spec.
 */
export function levelProgress(totalXP: number): LevelProgress {
  const clamped = Number.isFinite(totalXP) && totalXP > 0 ? totalXP : 0

  let index = 0
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (LEVEL_THRESHOLDS[i].minXP <= clamped) {
      index = i
    }
  }

  const current = LEVEL_THRESHOLDS[index]
  const next = LEVEL_THRESHOLDS[index + 1] ?? null
  const xpIntoLevel = clamped - current.minXP
  const xpForNextLevel = next ? next.minXP - current.minXP : null
  const fraction = next ? Math.min(1, Math.max(0, xpIntoLevel / xpForNextLevel!)) : 1

  return {
    level: current.level,
    currentThreshold: current.minXP,
    nextLevel: next ? next.level : null,
    nextThreshold: next ? next.minXP : null,
    xpIntoLevel,
    xpForNextLevel,
    fraction,
    isMax: next === null,
  }
}
