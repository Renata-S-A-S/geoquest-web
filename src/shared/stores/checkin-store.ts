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
  /**
   * Badge names the explorer already owned when the current check-in was
   * submitted — the "before" half of the `badge-diff.ts` snapshot. `null`
   * means "no snapshot taken", which makes the whole badge feature degrade
   * to silence instead of guessing. Deletable with `badge-diff.ts` once the
   * backend exposes `CheckInStatusResult.BadgesAwarded`.
   */
  badgeNamesBefore: string[] | null
  /** Touches ONLY `badgeNamesBefore` — never `pending` or `selectedPlace`. */
  setBadgeNamesBefore: (names: string[]) => void
  /** Touches ONLY `badgeNamesBefore` — never `pending` or `selectedPlace`. */
  clearBadgeNamesBefore: () => void
}

/** Shape persisted by a v1 client — the only field that ever existed before WU003b. */
interface PersistedStateV1 {
  pending: PendingCheckin | null
}

/** Shape persisted by a v2 client — v1 plus the `selectedPlace` slot (WU003b). */
interface PersistedStateV2 extends PersistedStateV1 {
  selectedPlace: SelectedPlace | null
}

/** Shape persisted by a v3 client — v2 plus the badge snapshot (issue #108). */
interface PersistedStateV3 extends PersistedStateV2 {
  badgeNamesBefore: string[] | null
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
 * router-state handoff dies on a mid-check-in refresh).
 *
 * `version: 3` (issue #108) adds `badgeNamesBefore`, the persisted "before"
 * half of the badge diff (`features/checkin/badge-diff.ts`).
 *
 * Both migrations MUST preserve every earlier field unchanged; they must
 * never reconstruct or drop one, since a v1 or v2 client may have a real
 * in-flight check-in persisted. The steps are written as separate, additive
 * `if`s so a v1 client migrates all the way to v3 in one pass.
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
      badgeNamesBefore: null,
      setBadgeNamesBefore: (names) => set({ badgeNamesBefore: names }),
      clearBadgeNamesBefore: () => set({ badgeNamesBefore: null }),
    }),
    {
      name: 'geoquest.pending-checkin',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pending: state.pending,
        selectedPlace: state.selectedPlace,
        badgeNamesBefore: state.badgeNamesBefore,
      }),
      migrate: (persistedState, version) => {
        let migrated = persistedState as Partial<PersistedStateV3>

        if (version <= 1) {
          migrated = { pending: (migrated as PersistedStateV1).pending, selectedPlace: null }
        }
        if (version <= 2) {
          migrated = { ...(migrated as PersistedStateV2), badgeNamesBefore: null }
        }

        return migrated as CheckinStoreState
      },
    }
  )
)
