import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Issue #115 — the persistence contract of `redemption-store`. Same shape as
 * `checkin-store.dom.test.ts`: a value written by one store instance must
 * survive in real `localStorage` and rehydrate into a freshly-imported
 * instance, which is how an app restart is simulated inside one test file.
 *
 * What is under test is not a convenience cache. The plain `qrToken` exists
 * only in the `POST /rewards/{id}/redeem` response and can never be
 * re-fetched, so the `userRewardId` persisted here is the ONLY way back to
 * an existing redemption. If it does not survive a reload, the redeem screen
 * has no way to tell "already redeemed" from "never redeemed" and would
 * redeem again — spending the explorer's GeoPoints a second time.
 */
async function importFreshRedemptionStore(tag: string) {
  const specifier = '@/shared/stores/redemption-store?' + tag
  return import(specifier) as Promise<typeof import('@/shared/stores/redemption-store')>
}

describe('redemption-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists a remembered redemption and rehydrates it into a fresh instance', async () => {
    const { useRedemptionStore: first } = await importFreshRedemptionStore('fresh-0')
    first.getState().rememberRedemption('reward-1', 'user-reward-1')

    const raw = window.localStorage.getItem('geoquest.active-redemption')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).state.activeByRewardId).toEqual({
      'reward-1': 'user-reward-1',
    })

    const { useRedemptionStore: second } = await importFreshRedemptionStore('fresh-1')
    await second.persist.rehydrate()

    expect(second.getState().activeByRewardId['reward-1']).toBe('user-reward-1')
  })

  /**
   * The store is keyed BY REWARD rather than holding a single slot, and this
   * is the test that pins why. With one slot, redeeming reward B would
   * overwrite the pointer to A's live redemption — and the redeem screen,
   * finding nothing stored for A, would offer to redeem it again. The
   * explorer would pay for A twice for the sole reason that they looked at
   * another reward in between.
   */
  it('keeps one entry per reward so a second redemption never erases the first', async () => {
    const { useRedemptionStore: store } = await importFreshRedemptionStore('fresh-2')
    store.getState().rememberRedemption('reward-1', 'user-reward-1')
    store.getState().rememberRedemption('reward-2', 'user-reward-2')

    expect(store.getState().activeByRewardId).toEqual({
      'reward-1': 'user-reward-1',
      'reward-2': 'user-reward-2',
    })
  })

  it('forgets only the named reward and the removal survives a rehydrate', async () => {
    const { useRedemptionStore: first } = await importFreshRedemptionStore('fresh-3')
    first.getState().rememberRedemption('reward-1', 'user-reward-1')
    first.getState().rememberRedemption('reward-2', 'user-reward-2')

    first.getState().forgetRedemption('reward-1')

    const { useRedemptionStore: second } = await importFreshRedemptionStore('fresh-4')
    await second.persist.rehydrate()

    expect(second.getState().activeByRewardId).toEqual({ 'reward-2': 'user-reward-2' })
  })

  /**
   * The token has no slot here and must never get one. This asserts the
   * absence structurally — every persisted value is a plain id string — so a
   * later slice cannot quietly widen the entry into `{ userRewardId, qrToken }`
   * and give the unrecoverable-by-design token a permanent home on disk.
   */
  it('persists ids only, never a token', async () => {
    const { useRedemptionStore: store } = await importFreshRedemptionStore('fresh-5')
    store.getState().rememberRedemption('reward-1', 'user-reward-1')

    const persisted = JSON.parse(
      window.localStorage.getItem('geoquest.active-redemption') as string
    )
    expect(
      Object.values(persisted.state.activeByRewardId).every((v) => typeof v === 'string')
    ).toBe(true)
    expect(window.localStorage.getItem('geoquest.active-redemption')).not.toContain('qrToken')
  })
})
