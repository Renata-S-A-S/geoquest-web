import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { INTEREST_CATALOG } from '@/features/gamification/interests-catalog'
import { categorySchema } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — spec "Interests Restricted to the Real Backend
 * Enum": exactly the 6 real `Category` values, Spanish labels. No
 * design-mock placeholder labels ("Café", "Deporte", "Música").
 */
describe('INTEREST_CATALOG', () => {
  it('has exactly 6 entries', () => {
    expect(INTEREST_CATALOG).toHaveLength(6)
  })

  it('every value is a real categorySchema enum member', () => {
    for (const entry of INTEREST_CATALOG) {
      expect(() => categorySchema.parse(entry.value)).not.toThrow()
    }
  })

  it('covers every categorySchema option exactly once, in the spec-literal order', () => {
    expect(INTEREST_CATALOG.map((entry) => entry.value)).toEqual([
      'Gastronomia',
      'Naturaleza',
      'HistoriaCultura',
      'Aventura',
      'Arte',
      'Alojamiento',
    ])
  })

  it('maps HistoriaCultura to a Spanish "Historia y cultura" label', () => {
    const entry = INTEREST_CATALOG.find((e) => e.value === 'HistoriaCultura')
    expect(entry?.label).toBe('Historia y cultura')
  })

  it('never includes a design-mock placeholder label', () => {
    const labels = INTEREST_CATALOG.map((entry) => entry.label)
    expect(labels).not.toContain('Café')
    expect(labels).not.toContain('Deporte')
    expect(labels).not.toContain('Música')
  })

  /**
   * WU11 (i18n) — labelKey resolves through the shared gamification.json
   * dictionary, in BOTH languages, and matches the (deprecated) static
   * `label` under `es` — proving the dictionary is the real source of
   * truth `edit-profile-page.tsx` (PR4c) will read from next.
   */
  it('every labelKey resolves under the gamification namespace to the es label, for es', () => {
    for (const entry of INTEREST_CATALOG) {
      expect(i18next.t(entry.labelKey, { ns: 'gamification' })).toBe(entry.label)
    }
  })

  it('every labelKey resolves to a real, non-empty EN translation distinct from the raw key', async () => {
    await i18next.changeLanguage('en')
    for (const entry of INTEREST_CATALOG) {
      const enLabel = i18next.t(entry.labelKey, { ns: 'gamification' })
      expect(enLabel).not.toBe(entry.labelKey)
      expect(enLabel.length).toBeGreaterThan(0)
    }
    await i18next.changeLanguage('es')
  })
})
