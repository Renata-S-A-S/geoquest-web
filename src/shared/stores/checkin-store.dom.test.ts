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
    expect(
      JSON.parse(window.localStorage.getItem('geoquest.pending-checkin') as string).state.pending
    ).not.toBeNull()

    firstInstance.getState().clearPending()
    expect(
      JSON.parse(window.localStorage.getItem('geoquest.pending-checkin') as string).state.pending
    ).toBeNull()

    const { useCheckinStore: secondInstance } = await importFreshCheckinStore('fresh-3')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().pending).toBeNull()
  })
})

/**
 * WU003b (map discovery) — `selectedPlace` slot + v1->v2 migration (design
 * doc "Migration / Rollout", "Architecture Decisions" #1). The migration
 * MUST preserve `pending` unchanged: it's the only field a v1 client could
 * have persisted, and a lost `pending` would silently strand a check-in
 * that's still waiting on manual review.
 */
describe('checkin-store v1 -> v2 migration', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('preserves a populated pending field unchanged and defaults selectedPlace to null', async () => {
    const v1State = {
      state: {
        pending: {
          checkInId: 'checkin-v1-migrated',
          placeName: 'El Cielo',
          createdAtIso: '2026-08-20T00:00:00.000Z',
        },
      },
      version: 1,
    }
    window.localStorage.setItem('geoquest.pending-checkin', JSON.stringify(v1State))

    const { useCheckinStore } = await importFreshCheckinStore('migration-0')
    await useCheckinStore.persist.rehydrate()

    expect(useCheckinStore.getState().pending).toEqual({
      checkInId: 'checkin-v1-migrated',
      placeName: 'El Cielo',
      createdAtIso: '2026-08-20T00:00:00.000Z',
    })
    expect(useCheckinStore.getState().selectedPlace).toBeNull()
  })

  it('preserves a null pending field through the migration too', async () => {
    const v1State = { state: { pending: null }, version: 1 }
    window.localStorage.setItem('geoquest.pending-checkin', JSON.stringify(v1State))

    const { useCheckinStore } = await importFreshCheckinStore('migration-1')
    await useCheckinStore.persist.rehydrate()

    expect(useCheckinStore.getState().pending).toBeNull()
    expect(useCheckinStore.getState().selectedPlace).toBeNull()
  })

  it('persists state under version 2 after a write', async () => {
    const { useCheckinStore } = await importFreshCheckinStore('migration-2')
    useCheckinStore.getState().setSelectedPlace({ placeId: 'place-1', placeName: 'MAMM' })

    const raw = JSON.parse(window.localStorage.getItem('geoquest.pending-checkin') as string)
    expect(raw.version).toBe(2)
  })
})

/**
 * `setSelectedPlace`/`clearSelectedPlace` (design doc decisions #1, #11) —
 * each MUST touch only `selectedPlace`, never `pending`. This distinction
 * matters for a later slice (PR3): `clearSelectedPlace()` fires on check-in
 * terminal state, completely independent of the existing `pending` /
 * `clearPending()` lifecycle.
 */
describe('setSelectedPlace / clearSelectedPlace', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('setSelectedPlace sets selectedPlace and leaves pending untouched', async () => {
    const { useCheckinStore } = await importFreshCheckinStore('selected-0')
    useCheckinStore.getState().setPending({ checkInId: 'checkin-unrelated', placeName: 'Museo' })

    useCheckinStore
      .getState()
      .setSelectedPlace({ placeId: 'place-19', placeName: 'Avenida El Poblado' })

    expect(useCheckinStore.getState().selectedPlace).toEqual({
      placeId: 'place-19',
      placeName: 'Avenida El Poblado',
    })
    expect(useCheckinStore.getState().pending).toEqual(
      expect.objectContaining({ checkInId: 'checkin-unrelated', placeName: 'Museo' })
    )
  })

  it('clearSelectedPlace nulls only selectedPlace and leaves pending untouched', async () => {
    const { useCheckinStore } = await importFreshCheckinStore('selected-1')
    useCheckinStore.getState().setPending({ checkInId: 'checkin-unrelated-2', placeName: 'Museo' })
    useCheckinStore
      .getState()
      .setSelectedPlace({ placeId: 'place-19', placeName: 'Avenida El Poblado' })

    useCheckinStore.getState().clearSelectedPlace()

    expect(useCheckinStore.getState().selectedPlace).toBeNull()
    expect(useCheckinStore.getState().pending).toEqual(
      expect.objectContaining({ checkInId: 'checkin-unrelated-2', placeName: 'Museo' })
    )
  })
})
