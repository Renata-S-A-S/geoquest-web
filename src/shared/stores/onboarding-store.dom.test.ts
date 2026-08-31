import { beforeEach, describe, expect, it } from 'vitest'

/**
 * explorer-onboarding-settings PR4 — mirrors `theme-store.dom.test.ts`'s
 * `importFresh…` trick: a query-string variant of the same module specifier
 * is the only way to get a genuinely fresh module instance (own `create()`
 * call) within a single test file, simulating an app restart.
 */
async function importFreshOnboardingStore(tag: string) {
  const specifier = '@/shared/stores/onboarding-store?' + tag
  return import(specifier) as Promise<typeof import('@/shared/stores/onboarding-store')>
}

describe('onboarding-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to hasCompletedOnboarding=false before any explicit flag is set', async () => {
    const { useOnboardingStore } = await importFreshOnboardingStore('default-0')
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false)
  })

  it('persists the exact literal zustand shape when setHasCompletedOnboarding(true) is called (D2)', async () => {
    const { useOnboardingStore } = await importFreshOnboardingStore('literal-0')
    useOnboardingStore.getState().setHasCompletedOnboarding(true)

    const raw = window.localStorage.getItem('geoquest.onboarding')
    expect(raw).toBe('{"state":{"hasCompletedOnboarding":true},"version":1}')
  })

  it('setHasCompletedOnboarding(true) updates in-memory state and rehydrates a fresh instance with the same value', async () => {
    const { useOnboardingStore: firstInstance } = await importFreshOnboardingStore('rehydrate-0')
    firstInstance.getState().setHasCompletedOnboarding(true)
    expect(firstInstance.getState().hasCompletedOnboarding).toBe(true)

    const { useOnboardingStore: secondInstance } = await importFreshOnboardingStore('rehydrate-1')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().hasCompletedOnboarding).toBe(true)
  })

  it('a fresh instance with no persisted entry rehydrates to false (absent flag = first run)', async () => {
    const { useOnboardingStore } = await importFreshOnboardingStore('absent-0')
    await useOnboardingStore.persist.rehydrate()

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false)
  })
})
