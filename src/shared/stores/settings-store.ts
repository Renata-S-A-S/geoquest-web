import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface SettingsStoreState {
  notificationsEnabled: boolean
  privacyAnalytics: boolean
  setNotificationsEnabled: (value: boolean) => void
  setPrivacyAnalytics: (value: boolean) => void
}

/**
 * explorer-onboarding-settings PR6 (design decision D6) — local-only
 * notification/privacy preferences for `/configuracion`. No backend: the
 * design explicitly scopes these two flags to the client, unlike
 * `auth-store.ts`. Mirrors `onboarding-store.ts` / `checkin-store.ts`'s
 * shape: `persist` middleware, `version: 1`, no `migrate` (two independent
 * booleans have no shape to migrate yet), `partialize` to keep the
 * persisted surface explicit.
 *
 * Both default to `true` — an opt-in-by-default engagement/analytics
 * posture, consistent with the rest of the app having no separate consent
 * gate for either. Neither the spec nor the design pins an explicit
 * default; flagged as a judgment call in apply-progress.
 */
export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      notificationsEnabled: true,
      privacyAnalytics: true,
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setPrivacyAnalytics: (value) => set({ privacyAnalytics: value }),
    }),
    {
      name: 'geoquest.settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notificationsEnabled: state.notificationsEnabled,
        privacyAnalytics: state.privacyAnalytics,
      }),
    }
  )
)
