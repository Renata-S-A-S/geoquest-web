import type { Category } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — spec "Interests Restricted to the Real Backend
 * Enum": exactly the 6 real `Category` values. NEVER add a design-mock
 * placeholder label ("Café", "Deporte", "Música") — those do not
 * correspond to any real backend value.
 *
 * WU11 (i18n) — these are DISPLAY labels for a fixed backend enum, not
 * free text, so the source of truth moved to `gamification.json` under
 * `interests.<Category>` (both `es`/`en`). `labelKey` is the forward
 * lookup path — read it with `t(entry.labelKey, { ns: 'gamification' })`.
 * `label` is kept, unchanged, ONLY because `edit-profile-page.tsx` (PR4c)
 * still reads it directly and has not migrated to `t()` yet; PR4c should
 * switch that render to `labelKey` and then drop `label` from this type.
 */
export interface InterestCatalogEntry {
  value: Category
  /** @deprecated kept for `edit-profile-page.tsx` (PR4c) until it migrates to `labelKey` */
  label: string
  labelKey: string
}

export const INTEREST_CATALOG: readonly InterestCatalogEntry[] = [
  { value: 'Gastronomia', label: 'Gastronomía', labelKey: 'interests.Gastronomia' },
  { value: 'Naturaleza', label: 'Naturaleza', labelKey: 'interests.Naturaleza' },
  {
    value: 'HistoriaCultura',
    label: 'Historia y cultura',
    labelKey: 'interests.HistoriaCultura',
  },
  { value: 'Aventura', label: 'Aventura', labelKey: 'interests.Aventura' },
  { value: 'Arte', label: 'Arte', labelKey: 'interests.Arte' },
  { value: 'Alojamiento', label: 'Alojamiento', labelKey: 'interests.Alojamiento' },
]
