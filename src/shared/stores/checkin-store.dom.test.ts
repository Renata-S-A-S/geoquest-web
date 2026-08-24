import { beforeEach, describe, expect, it } from 'vitest'

/**
 * WU9 (issue #9), PR4 — `checkin-store` is a `persist`-backed zustand store,
 * deliberately separate from `auth-store.ts` (which is documented as
 * memory-only by design, see design doc "Architecture Decisions" #3). This
 * suite proves the persistence contract itself: a value written by one
 * store instance survives in real `localStorage` and rehydrates into a
 * freshly-imported instance, simulating an app restart. A query-string
 * variant of the same module specifier is the only way to get a genuinely
 * fresh module instance (own `create()` call) within a single test file;
 * the specifier is built from a template with a variable on purpose so TS's
 * static import-specifier resolution doesn't try (and fail) to resolve each
 * synthetic query variant as its own module — the return type is still
 * fully checked via `typeof import(...)` against the real path.
 */
async function importFreshCheckinStore(tag: string) {
  const specifier = '@/shared/stores/checkin-store?' + tag
  return import(specifier) as Promise<typeof import('@/shared/stores/checkin-store')>
}

describe('checkin-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists setPending to localStorage and rehydrates a fresh instance with the same entry', async () => {
    const { useCheckinStore: firstInstance } = await importFreshCheckinStore('fresh-0')
    firstInstance.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })

    const raw = window.localStorage.getItem('geoquest.pending-checkin')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).state.pending).toMatchObject({
      checkInId: 'checkin-1',
      placeName: 'El Cielo',
    })

    const { useCheckinStore: secondInstance } = await importFreshCheckinStore('fresh-1')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().pending).toMatchObject({
      checkInId: 'checkin-1',
      placeName: 'El Cielo',
    })
  })

  it('clearPending empties the persisted key so a fresh instance rehydrates to null', async () => {
    const { useCheckinStore: firstInstance } = await importFreshCheckinStore('fresh-2')
    firstInstance.getState().setPending({ checkInId: 'checkin-2', placeName: 'Museo' })
    expect(JSON.parse(window.localStorage.getItem('geoquest.pending-checkin') as string).state.pending).not.toBeNull()

    firstInstance.getState().clearPending()
    expect(JSON.parse(window.localStorage.getItem('geoquest.pending-checkin') as string).state.pending).toBeNull()

    const { useCheckinStore: secondInstance } = await importFreshCheckinStore('fresh-3')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().pending).toBeNull()
  })
})
