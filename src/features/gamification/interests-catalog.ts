import type { Category } from '@/shared/schemas/gamification'

/**
 * WU10 (gamification) — spec "Interests Restricted to the Real Backend
 * Enum": exactly the 6 real `Category` values with Spanish labels for the
 * picker. NEVER add a design-mock placeholder label ("Café", "Deporte",
 * "Música") — those do not correspond to any real backend value.
 */
export interface InterestCatalogEntry {
  value: Category
  label: string
}

export const INTEREST_CATALOG: readonly InterestCatalogEntry[] = [
  { value: 'Gastronomia', label: 'Gastronomía' },
  { value: 'Naturaleza', label: 'Naturaleza' },
  { value: 'HistoriaCultura', label: 'Historia y cultura' },
  { value: 'Aventura', label: 'Aventura' },
  { value: 'Arte', label: 'Arte' },
  { value: 'Alojamiento', label: 'Alojamiento' },
]
