import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface RedemptionStoreState {
  /**
   * `rewardId` -> `userRewardId` of the redemption currently held for that
   * reward. A map, not a single slot, for the reason spelled out below.
   */
  activeByRewardId: Record<string, string>
  rememberRedemption: (rewardId: string, userRewardId: string) => void
  forgetRedemption: (rewardId: string) => void
}

/** Shape persisted by a v1 client — the only shape that has ever existed. */
interface PersistedStateV1 {
  activeByRewardId: Record<string, string>
}

/**
 * Issue #115 — the pointer back to a redemption the explorer already paid
 * for. Persisted with `zustand/persist` + real `localStorage`, following
 * `checkin-store.ts`'s `pending` idiom exactly (same `persist` +
 * `partialize` + `version` shape), and kept in its OWN store rather than
 * added as a slice there: check-in and rewards share no lifecycle, and
 * `checkin-store` already carries three unrelated slots.
 *
 * WHY THIS HAS TO BE PERSISTED AT ALL. `POST /rewards/{id}/redeem` is the
 * only place the plain `qrToken` ever exists — the backend stores
 * `UserReward.QrTokenHash` and nothing else — so a redemption can never be
 * re-read in full. The redeem screen therefore cannot answer "did this
 * explorer already redeem this reward?" from the network alone: the only
 * token-free read, `GET /rewards/redemptions/{userRewardId}`, needs an id
 * this client is the sole holder of. Lose that id and the screen sees a
 * blank slate and offers to redeem again — which reserves and spends the
 * explorer's GeoPoints a SECOND time and mints a token that orphans the
 * first. The persisted id is what makes a remount safe.
 *
 * WHY THE TOKEN IS NOT HERE. The id is a pointer to a server-side record
 * and is useless to anyone who cannot authenticate as its owner; the token
 * is the bearer credential that redeems the reward. Persisting the id costs
 * nothing if the device is read, persisting the token would put a
 * spendable claim on disk for its whole 30-minute window. The token stays
 * in React component state and dies with the screen — which is also why
 * `useRedeemReward` pins `gcTime: 0`. That asymmetry is the whole design:
 * persist the id, never the token.
 *
 * WHY IT IS KEYED BY REWARD. A single slot would be overwritten the moment
 * the explorer redeemed a second reward, and the first reward's live
 * redemption would become invisible to the app — so its screen would offer
 * to redeem it again, the exact double charge this store exists to prevent.
 * Entries are pruned on a terminal status (`Redeemed`, `Expired`,
 * `Failed`), so the map stays bounded by the rewards one explorer actually
 * holds open at once.
 */
export const useRedemptionStore = create<RedemptionStoreState>()(
  persist(
    (set) => ({
      activeByRewardId: {},
      rememberRedemption: (rewardId, userRewardId) =>
        set((state) => ({
          activeByRewardId: { ...state.activeByRewardId, [rewardId]: userRewardId },
        })),
      forgetRedemption: (rewardId) =>
        set((state) => {
          const { [rewardId]: _removed, ...rest } = state.activeByRewardId
          return { activeByRewardId: rest }
        }),
    }),
    {
      name: 'geoquest.active-redemption',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedStateV1 => ({ activeByRewardId: state.activeByRewardId }),
    }
  )
)
