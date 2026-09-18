import { StrictMode } from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { useCheckin } from '@/features/checkin/use-checkin'
import { CheckinPage } from '@/features/checkin/checkin-page'
import {
  MediaPermissionError,
  captureFrame,
  requestCameraStream,
  stopCameraStream,
} from '@/features/checkin/media/capture-photo'
import { requestPosition } from '@/features/checkin/media/request-position'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { queryClient } from '@/shared/lib/query-client'
import { gamificationKeys } from '@/features/gamification/queries'
import type { BadgeAward } from '@/shared/schemas/gamification'

/**
 * Design decision #9: mock the two browser-touching media adapters entirely
 * (never `checkin-api`, which is exercised for real via MSW). `importOriginal`
 * keeps the real error classes (`MediaPermissionError`, etc.) so `instanceof`
 * checks inside `use-checkin.ts` still work against the mocked module.
 */
vi.mock('@/features/checkin/media/capture-photo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/checkin/media/capture-photo')>()
  return {
    ...actual,
    requestCameraStream: vi.fn(),
    captureFrame: vi.fn(),
    stopCameraStream: vi.fn(),
  }
})

vi.mock('@/features/checkin/media/request-position', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/checkin/media/request-position')>()
  return { ...actual, requestPosition: vi.fn() }
})

const baseURL = TEST_API_BASE_URL
const fakeStream = { getTracks: () => [] } as unknown as MediaStream
const fakePosition = { latitude: 6.2234, longitude: -75.5802, gpsAccuracyMeters: 12.5 }
const fakeBlob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' })
/** WU003b — replaces the old `SEED_PLACE_ID`/`SEED_PLACE_NAME` constants. */
const fakeSelectedPlace = { placeId: 'place-42', placeName: 'Parque Arví' }

function statusPayload(overrides: Record<string, unknown> = {}) {
  return {
    checkInId: 'checkin-1',
    validationStatus: 0,
    awardStatus: 0,
    xpAwarded: 0,
    geoPointsAwarded: 0,
    rejectionReason: null,
    createdAt: '2026-08-24T00:00:00Z',
    ...overrides,
  }
}

function mockHappyPermissions() {
  vi.mocked(requestCameraStream).mockResolvedValue(fakeStream)
  vi.mocked(requestPosition).mockResolvedValue(fakePosition)
  vi.mocked(captureFrame).mockResolvedValue(fakeBlob)
}

function seedSelectedPlace() {
  useCheckinStore.getState().setSelectedPlace(fakeSelectedPlace)
}

async function renderInCameraState() {
  mockHappyPermissions()
  seedSelectedPlace()
  const hook = renderHook(() => useCheckin())
  await waitFor(() => expect(hook.result.current.state).toEqual({ kind: 'camera' }))
  return hook
}

describe('useCheckin', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('starts in requesting-permissions and moves to camera once camera+GPS are granted', async () => {
    mockHappyPermissions()

    const { result } = renderHook(() => useCheckin())

    expect(result.current.state).toEqual({ kind: 'requesting-permissions' })
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
  })

  it('reaches camera under React StrictMode (mount->cleanup->remount) instead of hanging on requesting-permissions', async () => {
    // Reproduces a real bug found by manual testing: `unmountedRef` was set
    // to `true` by StrictMode's simulated cleanup and never reset on the
    // real remount, so every later state update silently no-opped forever.
    mockHappyPermissions()

    const { result } = renderHook(() => useCheckin(), { wrapper: StrictMode })

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
  })

  it('requests the camera exactly once under StrictMode, not twice concurrently', async () => {
    // Regression: StrictMode's mount->cleanup->remount cycle re-runs the
    // mount effect synchronously, before the first getUserMedia() call
    // resolves. Without reusing the in-flight acquisition, both the
    // "throwaway" and the "real" mount independently call
    // requestCameraStream(), so the physical camera gets requested twice
    // concurrently — most webcam drivers don't serve two live captures
    // cleanly, so the permission indicator turns on but the video stays
    // black. jsdom's mocked getUserMedia can't reproduce the hardware
    // symptom itself, but it can prove the fix: exactly one real call.
    mockHappyPermissions()

    const { result } = renderHook(() => useCheckin(), { wrapper: StrictMode })

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))

    expect(requestCameraStream).toHaveBeenCalledTimes(1)
  })

  it('actually wires the acquired stream to the rendered <video> element (not just internal state)', async () => {
    // Regression, found by real-browser verification of the StrictMode fix
    // above: `videoRef.current` is still null when `acquirePermissions`
    // resolves, because `checkin-page.tsx` only renders the <video> tag
    // once `state.kind` becomes 'camera' — a render that hasn't happened
    // yet at that point. The old code assigned `srcObject` there and never
    // again, so the assignment was silently always a no-op: `state.kind`
    // correctly reached 'camera' (every other test here only checks
    // that), but the video element stayed genuinely blank. `use-checkin`'s
    // own `renderHook` tests can't catch this — they never mount the real
    // <video> JSX — so this one renders the actual `CheckinPage`.
    mockHappyPermissions()
    seedSelectedPlace()

    render(
      <MemoryRouter>
        <CheckinPage />
      </MemoryRouter>
    )

    const video = await waitFor(() => {
      const el = document.querySelector('video')
      expect(el).not.toBeNull()
      return el as HTMLVideoElement
    })

    await waitFor(() => expect(video.srcObject).toBe(fakeStream))
  })

  it('enters permission-denied{camera} on a camera MediaPermissionError, and retry re-requests permissions', async () => {
    vi.mocked(requestCameraStream).mockRejectedValueOnce(new MediaPermissionError('camera'))
    vi.mocked(requestPosition).mockResolvedValue(fakePosition)

    const { result } = renderHook(() => useCheckin())

    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'permission-denied', device: 'camera' })
    )

    vi.mocked(requestCameraStream).mockResolvedValue(fakeStream)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
  })

  it('enters permission-denied{location} on a location MediaPermissionError', async () => {
    vi.mocked(requestCameraStream).mockResolvedValue(fakeStream)
    vi.mocked(requestPosition).mockRejectedValueOnce(new MediaPermissionError('location'))

    const { result } = renderHook(() => useCheckin())

    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'permission-denied', device: 'location' })
    )
  })

  it('happy path: capture -> upload -> create -> polling -> approved with awarded xp/points', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      ),
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(
          statusPayload({
            validationStatus: 2,
            awardStatus: 1,
            xpAwarded: 50,
            geoPointsAwarded: 10,
          })
        )
      )
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.state).toEqual({ kind: 'pending', checkInId: 'checkin-1' })
      expect(useCheckinStore.getState().pending).toMatchObject({
        checkInId: 'checkin-1',
        placeName: fakeSelectedPlace.placeName,
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(result.current.state).toEqual({
        kind: 'approved',
        xpAwarded: 50,
        geoPointsAwarded: 10,
        placeName: fakeSelectedPlace.placeName,
      })
      expect(useCheckinStore.getState().pending).toBeNull()
      // Design decisions #10/#11: `selectedPlace` is cleared exactly once on
      // the approved terminal state, after its `placeName` was captured into
      // the returned state above.
      expect(useCheckinStore.getState().selectedPlace).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads placeId from checkinStore.selectedPlace for the POST /checkins body, not a seed constant', async () => {
    const { result } = await renderInCameraState()

    let capturedPlaceId: string | undefined
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, async ({ request }) => {
        const body = (await request.json()) as { placeId: string }
        capturedPlaceId = body.placeId
        return HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      })
    )

    act(() => result.current.capture())

    await waitFor(() => expect(capturedPlaceId).toBe(fakeSelectedPlace.placeId))
  })

  it('errors out defensively if selectedPlace is missing at submit time (guard-bypass safety net)', async () => {
    const { result } = await renderInCameraState()
    useCheckinStore.getState().clearSelectedPlace()

    act(() => result.current.capture())

    await waitFor(() => expect(result.current.state.kind).toBe('error'))
  })

  it('poll status 1 (PendingManualReview) -> pending-review, no further poll requests', async () => {
    const { result } = await renderInCameraState()

    let statusRequestCount = 0
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      ),
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        statusRequestCount += 1
        return HttpResponse.json(statusPayload({ validationStatus: 1 }))
      })
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })

      expect(result.current.state).toEqual({ kind: 'pending-review', checkInId: 'checkin-1' })
      expect(statusRequestCount).toBe(1)
      // Design decision #4: pending-review keeps the persisted entry (never
      // clears it) so the follow-up banner can still resolve it later.
      expect(useCheckinStore.getState().pending).toMatchObject({ checkInId: 'checkin-1' })
      // pending-review is NOT a terminal state — selectedPlace must stay set
      // so the flow can still resolve to approved/rejected later.
      expect(useCheckinStore.getState().selectedPlace).toEqual(fakeSelectedPlace)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(statusRequestCount).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('status stays 0 (Pending) for 120s -> pending-review at the deadline, with <= 24 requests', async () => {
    const { result } = await renderInCameraState()

    let statusRequestCount = 0
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      ),
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        statusRequestCount += 1
        return HttpResponse.json(statusPayload({ validationStatus: 0 }))
      })
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000)
      })

      expect(result.current.state).toEqual({ kind: 'pending-review', checkInId: 'checkin-1' })
      expect(statusRequestCount).toBeLessThanOrEqual(24)
      expect(statusRequestCount).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops polling on unmount (no further requests after unmount)', async () => {
    const { result, unmount } = await renderInCameraState()

    let statusRequestCount = 0
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      ),
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        statusRequestCount += 1
        return HttpResponse.json(statusPayload({ validationStatus: 0 }))
      })
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })

      const countBeforeUnmount = statusRequestCount
      expect(countBeforeUnmount).toBeGreaterThan(0)

      unmount()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(statusRequestCount).toBe(countBeforeUnmount)
    } finally {
      vi.useRealTimers()
    }
  })

  it('400 OutOfRadius -> rejected-rule{OutOfRadius}, never rejected-content', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: 'CreateCheckInCommand.OutOfRadius' }, { status: 400 })
      )
    )

    act(() => result.current.capture())

    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'rejected-rule', rule: 'OutOfRadius' })
    )
    expect(result.current.state.kind).not.toBe('rejected-content')
    // A rule rejection (immediate 400, not a poll terminal state) allows
    // retrying the same place — selectedPlace must NOT be cleared here.
    expect(useCheckinStore.getState().selectedPlace).toEqual(fakeSelectedPlace)
  })

  it('poll status 3 (Rejected) -> rejected-content, with no rejectionReason leaked into state', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      ),
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(
          statusPayload({
            validationStatus: 3,
            rejectionReason: 'nudity-detected-should-never-leak',
          })
        )
      )
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })

      expect(result.current.state).toEqual({ kind: 'rejected-content' })
      expect(JSON.stringify(result.current.state)).not.toContain(
        'nudity-detected-should-never-leak'
      )
      expect(useCheckinStore.getState().pending).toBeNull()
      // Content rejection IS a terminal state — selectedPlace must clear
      // (design decision #11), same as approved.
      expect(useCheckinStore.getState().selectedPlace).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('retry from a rejected-content terminal goes back to camera', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      ),
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(statusPayload({ validationStatus: 3 }))
      )
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(result.current.state).toEqual({ kind: 'rejected-content' })
    } finally {
      vi.useRealTimers()
    }

    act(() => result.current.retry())

    // Issue #152: the stream was released at capture time, so retry now has
    // to re-acquire it. `camera` is therefore reached asynchronously, after
    // a short `requesting-permissions` pass — the destination is unchanged.
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
  })

  it('an unrecognized 400 title or network failure falls back to a generic error state, with retry back to camera', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: 'CreateCheckInCommand.SomethingElse' }, { status: 400 })
      )
    )

    act(() => result.current.capture())
    await waitFor(() => expect(result.current.state.kind).toBe('error'))

    act(() => result.current.retry())

    // Issue #152: same as the rejected-content retry above — `camera` is now
    // reached through a re-acquisition instead of a live leftover stream.
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
  })
})

/**
 * Issue #108 — badge diff + streak. `CheckInStatusResult` has no badges
 * field, so the only way to name the badge a check-in unlocked is to diff
 * `GET /gaming/profile` before and after it. The "before" half MUST come
 * from the React Query cache the rest of the app already filled: adding a
 * request on the submit path would cost the explorer a round trip purely to
 * decorate a screen. Every failure mode degrades to the plain XP/GeoPoints
 * screen — never to an error.
 */
describe('useCheckin badge snapshot, diff and streak (issue #108)', () => {
  const CHECKIN_CREATED_AT = '2026-09-17T12:00:00Z'

  /**
   * Full `BadgeAwardResult` shape — `description` and `iconUrl` have been on
   * the wire since backend issue #41 closed (2026-08-24) and are now parsed
   * (issue #153), so a payload without them no longer passes the schema.
   */
  function badge(name: string, awardedAtUtc: string): BadgeAward {
    return { name, description: `Insignia ${name}.`, iconUrl: null, awardedAtUtc }
  }

  function profilePayload(overrides: Record<string, unknown> = {}) {
    return {
      explorerId: 'explorer-1',
      totalXP: 500,
      weeklyXP: 50,
      geoPointsBalance: 120,
      currentLevel: 'Explorador',
      currentStreak: 5,
      longestStreak: 9,
      lastActivityLocalDate: '2026-09-17',
      badges: [badge('Primer paso', '2026-01-01T00:00:00Z')],
      ...overrides,
    }
  }

  function seedProfileCache(badges: BadgeAward[]) {
    queryClient.setQueryData(gamificationKeys.profile, profilePayload({ badges }))
  }

  function mockSubmitRoutes() {
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      )
    )
  }

  function approvedStatusRoute() {
    return http.get(`${baseURL}/checkins/checkin-1`, () =>
      HttpResponse.json(
        statusPayload({
          validationStatus: 2,
          awardStatus: 1,
          xpAwarded: 50,
          geoPointsAwarded: 10,
          createdAt: CHECKIN_CREATED_AT,
        })
      )
    )
  }

  // Testing Library's global auto-cleanup unmounts the previous test's hook
  // AFTER this file's describe-level `afterEach`, so a late celebration fetch
  // can otherwise leak its `console.warn` onto the next test's spy. The
  // diagnostics cases below count those calls — clear on the way IN.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
    useCheckinStore.getState().clearBadgeNamesBefore()
    vi.restoreAllMocks()
  })

  /** Capture, then advance past the first poll tick and the profile refetch. */
  async function captureUntilApproved(capture: () => void) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
    } finally {
      vi.useRealTimers()
    }
  }

  it('snapshots the cached badge names during submitCheckin without issuing a profile request', async () => {
    const { result } = await renderInCameraState()
    seedProfileCache([badge('Primer paso', '2026-01-01T00:00:00Z')])

    let profileRequestCount = 0
    mockSubmitRoutes()
    server.use(
      http.get(`${baseURL}/gaming/profile`, () => {
        profileRequestCount += 1
        return HttpResponse.json(profilePayload())
      })
    )

    act(() => result.current.capture())
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'pending', checkInId: 'checkin-1' })
    )

    expect(useCheckinStore.getState().badgeNamesBefore).toEqual(['Primer paso'])
    expect(profileRequestCount).toBe(0)
  })

  it('clears any stale snapshot when the profile cache is empty at submit time', async () => {
    const { result } = await renderInCameraState()
    useCheckinStore.getState().setBadgeNamesBefore(['Stale badge from a previous check-in'])

    mockSubmitRoutes()

    act(() => result.current.capture())
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'pending', checkInId: 'checkin-1' })
    )

    expect(useCheckinStore.getState().badgeNamesBefore).toBeNull()
  })

  it('diffs the refetched profile on approval, exposes the streak, and clears the snapshot', async () => {
    const { result } = await renderInCameraState()
    seedProfileCache([badge('Primer paso', '2026-01-01T00:00:00Z')])

    mockSubmitRoutes()
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () =>
        HttpResponse.json(
          profilePayload({
            currentStreak: 7,
            badges: [
              badge('Primer paso', '2026-01-01T00:00:00Z'),
              badge('Explorador', '2026-09-17T12:00:03Z'),
            ],
          })
        )
      )
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(result.current.state.kind).toBe('approved')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.celebration).toEqual({
        unlockedBadgeNames: ['Explorador'],
        currentStreak: 7,
      })
      expect(useCheckinStore.getState().badgeNamesBefore).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * Issue #154 — THE path, not an edge case. Nothing but `/perfil` fills
   * `gamificationKeys.profile`, and map -> place -> check-in never goes
   * there, so the cache is cold for every first-time explorer. This case
   * used to assert the empty list as intended behaviour, which is how the
   * celebration shipped structurally unable to fire.
   */
  it('claims the badge this check-in unlocked even when the cache was cold at submit time', async () => {
    const { result } = await renderInCameraState()

    mockSubmitRoutes()
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () =>
        HttpResponse.json(
          profilePayload({
            currentStreak: 3,
            badges: [badge('Explorador', '2026-09-17T12:00:03Z')],
          })
        )
      )
    )

    await captureUntilApproved(result.current.capture)

    // No snapshot was ever taken — `badgeNamesBefore` stayed null through
    // the whole submit, exactly as on the real cold path.
    expect(useCheckinStore.getState().badgeNamesBefore).toBeNull()
    expect(result.current.state).toMatchObject({ kind: 'approved', xpAwarded: 50 })
    expect(result.current.celebration).toEqual({
      unlockedBadgeNames: ['Explorador'],
      currentStreak: 3,
    })
  })

  it('claims no badge on a cold cache when the only badge predates the check-in', async () => {
    const { result } = await renderInCameraState()

    mockSubmitRoutes()
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () =>
        HttpResponse.json(
          profilePayload({
            currentStreak: 3,
            // One second before `CHECKIN_CREATED_AT`: earned earlier, or on
            // another device. Without a baseline the timestamp is the only
            // thing standing between a celebration and a false claim.
            badges: [badge('Veterano', '2026-09-17T11:59:59Z')],
          })
        )
      )
    )

    await captureUntilApproved(result.current.capture)

    expect(result.current.state).toMatchObject({ kind: 'approved', xpAwarded: 50 })
    expect(result.current.celebration).toEqual({ unlockedBadgeNames: [], currentStreak: 3 })
  })

  it('renders the badge line on the approved screen after a cold-cache check-in', async () => {
    // The hook-level cases above stop at `celebration`; this one renders the
    // real `CheckinPage` so the assertion is the line an explorer sees.
    mockHappyPermissions()
    seedSelectedPlace()
    mockSubmitRoutes()
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () =>
        HttpResponse.json(
          profilePayload({
            currentStreak: 3,
            badges: [badge('Explorador', '2026-09-17T12:00:03Z')],
          })
        )
      )
    )

    render(
      <MemoryRouter>
        <CheckinPage />
      </MemoryRouter>
    )

    const captureButton = await screen.findByRole('button', {
      name: 'Tomar foto de check-in',
    })
    await act(async () => {
      captureButton.click()
    })

    // Real timers, so the wait has to clear `poll-schedule.ts`'s first
    // 2s tick before the approved screen can even render.
    expect(
      await screen.findByText('¡Desbloqueaste un badge nuevo: Explorador!', undefined, {
        timeout: 6_000,
      })
    ).toBeInTheDocument()
  }, 15_000)

  it('leaves the approved state untouched and raises no error when the profile refetch fails', async () => {
    const { result } = await renderInCameraState()
    seedProfileCache([badge('Primer paso', '2026-01-01T00:00:00Z')])

    mockSubmitRoutes()
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () => new HttpResponse(null, { status: 500 }))
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      expect(result.current.state).toEqual({
        kind: 'approved',
        xpAwarded: 50,
        geoPointsAwarded: 10,
        placeName: fakeSelectedPlace.placeName,
      })
      expect(result.current.celebration).toBeNull()
      expect(useCheckinStore.getState().badgeNamesBefore).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * Issue #154, point 4 — a cold snapshot and a dead profile endpoint render
   * the identical approved screen, so the console is the only place the
   * difference can show up while developing.
   */
  it('warns that no snapshot was taken when the cache was cold at submit time', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = await renderInCameraState()

    mockSubmitRoutes()
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () => HttpResponse.json(profilePayload()))
    )

    await captureUntilApproved(result.current.capture)

    expect(result.current.state.kind).toBe('approved')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/snapshot/i)
  })

  it('warns that the profile read failed, not that the snapshot was missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = await renderInCameraState()
    seedProfileCache([badge('Primer paso', '2026-01-01T00:00:00Z')])

    mockSubmitRoutes()
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () => new HttpResponse(null, { status: 500 }))
    )

    await captureUntilApproved(result.current.capture)

    expect(result.current.celebration).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/profile/i)
  })
})

/**
 * Issue #152 — camera teardown. The captured frame is already a `Blob` the
 * moment `captureFrame` resolves, so the `MediaStream` has no remaining job.
 * Releasing it only on unmount left the camera — and the OS camera
 * indicator — live through `sending` -> `pending` -> `approved`, i.e. up to
 * the 120s polling deadline in `poll-schedule.ts`.
 *
 * Stopping the stream at capture couples directly to `retry()`: it used to
 * fall back to a still-live `streamRef.current`, so every retry path that is
 * not `permission-denied` must now re-acquire, or the viewfinder comes back
 * black.
 */
describe('useCheckin camera teardown (issue #152)', () => {
  const secondStream = { getTracks: () => [] } as unknown as MediaStream

  // Testing Library's global auto-cleanup unmounts the previous test's hook
  // AFTER this file's describe-level `afterEach` has already run, so its
  // teardown `stopCameraStream` call lands on a freshly cleared mock and
  // leaks into the next test. Every assertion here counts those calls, so
  // the clear has to happen on the way IN, not on the way out.
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  function mockUploadRoutes() {
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      )
    )
  }

  it('stops the camera stream as soon as the frame is captured, before the upload completes', async () => {
    const { result } = await renderInCameraState()

    // Hold the upload open so the assertion lands strictly inside the
    // `sending` window — the exact stretch where the camera used to stay on.
    let releaseUpload!: () => void
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve
    })
    server.use(
      http.post(`${baseURL}/checkins/photo`, async () => {
        await uploadGate
        return HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      }),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      )
    )

    act(() => result.current.capture())

    await waitFor(() => expect(stopCameraStream).toHaveBeenCalledWith(fakeStream))
    expect(result.current.state).toEqual({ kind: 'sending', step: 'upload' })

    releaseUpload()
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'pending', checkInId: 'checkin-1' })
    )
  })

  it('releases the stream exactly once when unmounting after a capture', async () => {
    const { result, unmount } = await renderInCameraState()
    mockUploadRoutes()

    act(() => result.current.capture())
    await waitFor(() => expect(stopCameraStream).toHaveBeenCalledTimes(1))

    unmount()

    // The unmount cleanup must find an already-released ref and skip it
    // rather than stop the same tracks a second time.
    expect(stopCameraStream).toHaveBeenCalledTimes(1)
  })

  it('still releases the stream on unmount when no capture ever happened', async () => {
    const { unmount } = await renderInCameraState()

    unmount()

    expect(stopCameraStream).toHaveBeenCalledWith(fakeStream)
  })

  it('re-acquires the camera when retrying from rejected-content', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })
      ),
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(statusPayload({ validationStatus: 3 }))
      )
    )

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      act(() => result.current.capture())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(result.current.state).toEqual({ kind: 'rejected-content' })
    } finally {
      vi.useRealTimers()
    }

    vi.mocked(requestCameraStream).mockResolvedValue(secondStream)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
    expect(requestCameraStream).toHaveBeenCalledTimes(2)
  })

  it('re-acquires the camera when retrying from rejected-rule', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: 'CreateCheckInCommand.OutOfRadius' }, { status: 400 })
      )
    )

    act(() => result.current.capture())
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'rejected-rule', rule: 'OutOfRadius' })
    )

    vi.mocked(requestCameraStream).mockResolvedValue(secondStream)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
    expect(requestCameraStream).toHaveBeenCalledTimes(2)
    // An OutOfRadius rejection asks the explorer to get closer, so the
    // retry has to measure where they are now instead of resubmitting the
    // stale reading that was already rejected.
    expect(requestPosition).toHaveBeenCalledTimes(2)
  })

  it('re-acquires the camera when retrying from a generic error', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: 'CreateCheckInCommand.SomethingElse' }, { status: 400 })
      )
    )

    act(() => result.current.capture())
    await waitFor(() => expect(result.current.state.kind).toBe('error'))

    vi.mocked(requestCameraStream).mockResolvedValue(secondStream)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
    expect(requestCameraStream).toHaveBeenCalledTimes(2)
  })

  it('releases the still-live stream when retrying from an error raised before capture', async () => {
    // `submitCheckin` bails out before `captureFrame` when `selectedPlace`
    // went stale, so nothing released the stream on the way to `error`.
    // Re-acquiring on retry would otherwise overwrite `streamRef` and leave
    // the first camera on with no reference left to stop it.
    const { result } = await renderInCameraState()
    useCheckinStore.getState().clearSelectedPlace()

    act(() => result.current.capture())
    await waitFor(() => expect(result.current.state.kind).toBe('error'))
    expect(stopCameraStream).not.toHaveBeenCalled()

    vi.mocked(requestCameraStream).mockResolvedValue(secondStream)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.state).toEqual({ kind: 'camera' }))
    expect(stopCameraStream).toHaveBeenCalledWith(fakeStream)
    expect(stopCameraStream).toHaveBeenCalledTimes(1)
  })

  it('brings the viewfinder back to life after retrying a rejected check-in', async () => {
    // The hook-only tests above prove `requestCameraStream` runs again; only
    // a real render proves the <video> that remounts on the way back to
    // `camera` is wired to the NEW stream instead of coming back black.
    mockHappyPermissions()
    seedSelectedPlace()
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' })
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: 'CreateCheckInCommand.OutOfRadius' }, { status: 400 })
      )
    )

    render(
      <MemoryRouter>
        <CheckinPage />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect((document.querySelector('video') as HTMLVideoElement | null)?.srcObject).toBe(
        fakeStream
      )
    )

    const captureButton = await screen.findByRole('button', { name: 'Tomar foto de check-in' })
    act(() => captureButton.click())

    const retryButton = await screen.findByRole('button', { name: 'Intentar de nuevo' })
    vi.mocked(requestCameraStream).mockResolvedValue(secondStream)
    act(() => retryButton.click())

    await waitFor(() =>
      expect((document.querySelector('video') as HTMLVideoElement | null)?.srcObject).toBe(
        secondStream
      )
    )
  })
})
