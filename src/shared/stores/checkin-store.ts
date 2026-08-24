import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface PendingCheckin {
  checkInId: string
  placeName: string
  createdAtIso: string
}

export interface CheckinStoreState {
  pending: PendingCheckin | null
  setPending: (entry: { checkInId: string; placeName: string }) => void
  clearPending: () => void
}

/**
 * WU9 (issue #9), PR4 — tracks a single check-in left `pending-review` so
 * `PendingCheckinBanner` can resolve it once on the next app open. Persisted
 * with `zustand/persist` + real `localStorage`, DELIBERATELY separate from
 * `auth-store.ts`, which is documented memory-only by design (see
 * `auth-store.ts` and design doc "Architecture Decisions" #3 — do not mix a
 * persisted slice into the token store). `version: 1` + `partialize` keep the
 * persisted shape minimal and explicit.
 *
 * Write/clear timing (design decision #4): written as soon as `checkInId`
 * exists (on the `202` from `POST /checkins`, not only at the poll deadline)
 * so a tab closed mid-poll is still recoverable; cleared only on a terminal
 * outcome (`approved` / `rejected-content`) or when the follow-up banner
 * resolves it — never on a still-pending re-check, so the loop can resume on
 * a later app open.
 */
export const useCheckinStore = create<CheckinStoreState>()(
  persist(
    (set) => ({
      pending: null,
      setPending: ({ checkInId, placeName }) =>
        set({ pending: { checkInId, placeName, createdAtIso: new Date().toISOString() } }),
      clearPending: () => set({ pending: null }),
    }),
    {
      name: 'geoquest.pending-checkin',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pending: state.pending }),
    }
  )
)
