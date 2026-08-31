import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface OnboardingStoreState {
  hasCompletedOnboarding: boolean
  setHasCompletedOnboarding: (value: boolean) => void
}

/**
 * explorer-onboarding-settings PR4 — persists the first-run flag `ProtectedRoute`
 * reads to decide `/onboarding` vs `/login` for an unauthenticated visitor
 * (design decision D1). Mirrors `theme-store.ts` / `auth-store.ts`'s shape:
 * `persist` middleware, `version: 1`, no `migrate` (a single boolean has no
 * shape to migrate), `partialize` to keep the persisted surface explicit.
 *
 * Written on BOTH exits from splash (design decision D2): a successful
 * interests-step PATCH (`/onboarding/intereses`, PR5), and tapping "Ya tengo
 * cuenta" on `SplashPage` — a returning user on a fresh device is not a
 * first run either.
 */
export const useOnboardingStore = create<OnboardingStoreState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
    }),
    {
      name: 'geoquest.onboarding',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ hasCompletedOnboarding: state.hasCompletedOnboarding }),
    }
  )
)
