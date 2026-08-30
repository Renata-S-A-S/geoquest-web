import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { THEME_STORAGE_KEY, THEME_STORAGE_VERSION, type ThemeMode } from '@/shared/lib/theme'

export interface ThemeStoreState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

/**
 * Persists ONLY the explicit user choice. The resolved light/dark value is
 * derived by `useResolvedTheme()` from `mode` + `matchMedia`, never stored —
 * mirrors `i18n.ts` (persisted preference vs derived `i18n.resolvedLanguage`).
 *
 * `version: 1` with no `migrate` (like `auth-store.ts`, unlike
 * `checkin-store.ts`): the persisted surface is one 3-value enum, and
 * zustand's default shallow `merge` already resolves any future added field
 * to its default. The real forward-compat defense is that `index.html`'s
 * bootstrap validates `mode` against the literal union and ignores `version`
 * entirely.
 */
export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: THEME_STORAGE_KEY,
      version: THEME_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode }),
    }
  )
)
