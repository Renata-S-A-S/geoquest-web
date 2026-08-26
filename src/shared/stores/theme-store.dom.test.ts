import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Mirrors `checkin-store.dom.test.ts`'s `importFresh…` trick: a query-string
 * variant of the same module specifier is the only way to get a genuinely
 * fresh module instance (own `create()` call) within a single test file.
 */
async function importFreshThemeStore(tag: string) {
  const specifier = '@/shared/stores/theme-store?' + tag
  return import(specifier) as Promise<typeof import('@/shared/stores/theme-store')>
}

describe('theme-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to mode "system" before any explicit choice', async () => {
    const { useThemeStore } = await importFreshThemeStore('default-0')
    expect(useThemeStore.getState().mode).toBe('system')
  })

  it('persists the exact literal zustand shape when setMode("dark") is called', async () => {
    const { useThemeStore } = await importFreshThemeStore('literal-0')
    useThemeStore.getState().setMode('dark')

    const raw = window.localStorage.getItem('geoquest.theme')
    expect(raw).toBe('{"state":{"mode":"dark"},"version":1}')
  })

  it('setMode("light") updates in-memory state and rehydrates a fresh instance with the same value', async () => {
    const { useThemeStore: firstInstance } = await importFreshThemeStore('rehydrate-0')
    firstInstance.getState().setMode('light')
    expect(firstInstance.getState().mode).toBe('light')

    const { useThemeStore: secondInstance } = await importFreshThemeStore('rehydrate-1')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().mode).toBe('light')
  })

  it('setMode("system") after a prior explicit choice persists back to "system"', async () => {
    const { useThemeStore } = await importFreshThemeStore('roundtrip-0')
    useThemeStore.getState().setMode('dark')
    useThemeStore.getState().setMode('system')

    const raw = window.localStorage.getItem('geoquest.theme')
    expect(raw).toBe('{"state":{"mode":"system"},"version":1}')
  })
})
