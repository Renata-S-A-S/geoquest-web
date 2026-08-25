import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface PendingCheckin {
  checkInId: string
  placeName: string
  createdAtIso: string
}

/** A place selected on `place-discovery` (WU003b), carried into check-in. */
export interface SelectedPlace {
  placeId: string
  placeName: string
}

export interface CheckinStoreState {
  pending: PendingCheckin | null
  setPending: (entry: { checkInId: string; placeName: string }) => void
  clearPending: () => void
  selectedPlace: SelectedPlace | null
  /** Touches ONLY `selectedPlace` — never `pending` (design doc decision #1). */
  setSelectedPlace: (place: SelectedPlace) => void
  /** Touches ONLY `selectedPlace` — never `pending` (design doc decision #11). */
  clearSelectedPlace: () => void
}

/** Shape persisted by a v1 client — the only field that ever existed before WU003b. */
interface PersistedStateV1 {
  pending: PendingCheckin | null
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
 *
 * `version: 2` (WU003b, design doc "Migration / Rollout") adds the
 * `selectedPlace` slot — the place chosen on `place-discovery`, carried into
 * check-in via this store instead of router state (design decision #1: a
 * router-state handoff dies on a mid-check-in refresh). The v1->v2
 * `migrate` MUST preserve `pending` unchanged; it must never reconstruct or
 * drop it, since a v1 client may have a real in-flight check-in persisted.
 */
export const useCheckinStore = create<CheckinStoreState>()(
  persist(
    (set) => ({
      pending: null,
      setPending: ({ checkInId, placeName }) =>
        set({ pending: { checkInId, placeName, createdAtIso: new Date().toISOString() } }),
      clearPending: () => set({ pending: null }),
      selectedPlace: null,
      setSelectedPlace: (place) => set({ selectedPlace: place }),
      clearSelectedPlace: () => set({ selectedPlace: null }),
    }),
    {
      name: 'geoquest.pending-checkin',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ pending: state.pending, selectedPlace: state.selectedPlace }),
      migrate: (persistedState, version) => {
        if (version === 1) {
          const v1State = persistedState as PersistedStateV1
          return { pending: v1State.pending, selectedPlace: null }
        }
        return persistedState as CheckinStoreState
      },
    }
  )
)
