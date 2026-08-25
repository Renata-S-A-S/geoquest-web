import type { Category } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — spec "Interests Restricted to the Real Backend
 * Enum": exactly the 6 real `Category` values. NEVER add a design-mock
 * placeholder label ("Café", "Deporte", "Música") — those do not
 * correspond to any real backend value.
 *
 * WU11 (i18n) — these are DISPLAY labels for a fixed backend enum, not
 * free text, so the source of truth is `gamification.json` under
 * `interests.<Category>` (both `es`/`en`). `labelKey` is the forward
 * lookup path — read it with `t(entry.labelKey, { ns: 'gamification' })`.
 * The deprecated static `label` field (PR4a scaffold) was removed once
 * `edit-profile-page.tsx` (PR4c) migrated its render to `labelKey`.
 */
export interface InterestCatalogEntry {
  value: Category
  labelKey: string
}

export const INTEREST_CATALOG: readonly InterestCatalogEntry[] = [
  { value: 'Gastronomia', labelKey: 'interests.Gastronomia' },
  { value: 'Naturaleza', labelKey: 'interests.Naturaleza' },
  { value: 'HistoriaCultura', labelKey: 'interests.HistoriaCultura' },
  { value: 'Aventura', labelKey: 'interests.Aventura' },
  { value: 'Arte', labelKey: 'interests.Arte' },
  { value: 'Alojamiento', labelKey: 'interests.Alojamiento' },
]
