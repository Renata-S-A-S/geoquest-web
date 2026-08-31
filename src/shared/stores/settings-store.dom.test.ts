import { beforeEach, describe, expect, it } from 'vitest'

/**
 * explorer-onboarding-settings PR6 — mirrors `onboarding-store.dom.test.ts` /
 * `checkin-store.dom.test.ts`'s `importFresh…` trick: a query-string variant
 * of the same module specifier is the only way to get a genuinely fresh
 * module instance (own `create()` call) within a single test file,
 * simulating an app restart. Named `.dom.test.ts` (not the bare
 * `.test.ts` the tasks artifact literally names) because the store's
 * `persist` middleware needs real `window.localStorage`, which only exists
 * under the `jsdom` vitest project — same convention as `onboarding-store`
 * and `checkin-store`.
 */
async function importFreshSettingsStore(tag: string) {
  const specifier = '@/shared/stores/settings-store?' + tag
  return import(specifier) as Promise<typeof import('@/shared/stores/settings-store')>
}

describe('settings-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults notificationsEnabled and privacyAnalytics to true before any explicit change', async () => {
    const { useSettingsStore } = await importFreshSettingsStore('default-0')
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true)
    expect(useSettingsStore.getState().privacyAnalytics).toBe(true)
  })

  it('persists the exact literal zustand shape when both setters are called (D6)', async () => {
    const { useSettingsStore } = await importFreshSettingsStore('literal-0')
    useSettingsStore.getState().setNotificationsEnabled(false)
    useSettingsStore.getState().setPrivacyAnalytics(false)

    const raw = window.localStorage.getItem('geoquest.settings')
    expect(raw).toBe(
      '{"state":{"notificationsEnabled":false,"privacyAnalytics":false},"version":1}'
    )
  })

  it('setNotificationsEnabled toggles only that field and leaves privacyAnalytics untouched', async () => {
    const { useSettingsStore } = await importFreshSettingsStore('toggle-notif-0')
    useSettingsStore.getState().setNotificationsEnabled(false)

    expect(useSettingsStore.getState().notificationsEnabled).toBe(false)
    expect(useSettingsStore.getState().privacyAnalytics).toBe(true)
  })

  it('setPrivacyAnalytics toggles only that field and leaves notificationsEnabled untouched', async () => {
    const { useSettingsStore } = await importFreshSettingsStore('toggle-privacy-0')
    useSettingsStore.getState().setPrivacyAnalytics(false)

    expect(useSettingsStore.getState().privacyAnalytics).toBe(false)
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true)
  })

  it('setNotificationsEnabled(false) updates in-memory state and rehydrates a fresh instance with the same value', async () => {
    const { useSettingsStore: firstInstance } = await importFreshSettingsStore('rehydrate-0')
    firstInstance.getState().setNotificationsEnabled(false)
    expect(firstInstance.getState().notificationsEnabled).toBe(false)

    const { useSettingsStore: secondInstance } = await importFreshSettingsStore('rehydrate-1')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().notificationsEnabled).toBe(false)
  })

  it('a fresh instance with no persisted entry rehydrates to both defaults true', async () => {
    const { useSettingsStore } = await importFreshSettingsStore('absent-0')
    await useSettingsStore.persist.rehydrate()

    expect(useSettingsStore.getState().notificationsEnabled).toBe(true)
    expect(useSettingsStore.getState().privacyAnalytics).toBe(true)
  })
})
