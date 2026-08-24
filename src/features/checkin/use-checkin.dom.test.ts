import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { useCheckin } from '@/features/checkin/use-checkin'
import { MediaPermissionError, captureFrame, requestCameraStream } from '@/features/checkin/media/capture-photo'
import { requestPosition } from '@/features/checkin/media/request-position'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { SEED_PLACE_NAME } from '@/features/checkin/checkin-config'

/**
 * Design decision #9: mock the two browser-touching media adapters entirely
 * (never `checkin-api`, which is exercised for real via MSW). `importOriginal`
 * keeps the real error classes (`MediaPermissionError`, etc.) so `instanceof`
 * checks inside `use-checkin.ts` still work against the mocked module.
 */
vi.mock('@/features/checkin/media/capture-photo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/checkin/media/capture-photo')>()
  return { ...actual, requestCameraStream: vi.fn(), captureFrame: vi.fn(), stopCameraStream: vi.fn() }
})

vi.mock('@/features/checkin/media/request-position', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/checkin/media/request-position')>()
  return { ...actual, requestPosition: vi.fn() }
})

const baseURL = 'http://localhost:5219'
const fakeStream = { getTracks: () => [] } as unknown as MediaStream
const fakePosition = { latitude: 6.2234, longitude: -75.5802, gpsAccuracyMeters: 12.5 }
const fakeBlob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' })

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

async function renderInCameraState() {
  mockHappyPermissions()
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

  it('enters permission-denied{camera} on a camera MediaPermissionError, and retry re-requests permissions', async () => {
    vi.mocked(requestCameraStream).mockRejectedValueOnce(new MediaPermissionError('camera'))
    vi.mocked(requestPosition).mockResolvedValue(fakePosition)

    const { result } = renderHook(() => useCheckin())

    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'permission-denied', device: 'camera' }),
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
      expect(result.current.state).toEqual({ kind: 'permission-denied', device: 'location' }),
    )
  })

  it('happy path: capture -> upload -> create -> polling -> approved with awarded xp/points', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () => HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })),
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(
          statusPayload({ validationStatus: 2, awardStatus: 1, xpAwarded: 50, geoPointsAwarded: 10 }),
        ),
      ),
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
        placeName: SEED_PLACE_NAME,
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(result.current.state).toEqual({ kind: 'approved', xpAwarded: 50, geoPointsAwarded: 10 })
      expect(useCheckinStore.getState().pending).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('poll status 1 (PendingManualReview) -> pending-review, no further poll requests', async () => {
    const { result } = await renderInCameraState()

    let statusRequestCount = 0
    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () => HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })),
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        statusRequestCount += 1
        return HttpResponse.json(statusPayload({ validationStatus: 1 }))
      }),
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
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () => HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })),
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        statusRequestCount += 1
        return HttpResponse.json(statusPayload({ validationStatus: 0 }))
      }),
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
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () => HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })),
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        statusRequestCount += 1
        return HttpResponse.json(statusPayload({ validationStatus: 0 }))
      }),
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
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: 'CreateCheckInCommand.OutOfRadius' }, { status: 400 }),
      ),
    )

    act(() => result.current.capture())

    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'rejected-rule', rule: 'OutOfRadius' }),
    )
    expect(result.current.state.kind).not.toBe('rejected-content')
  })

  it('poll status 3 (Rejected) -> rejected-content, with no rejectionReason leaked into state', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () => HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })),
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(
          statusPayload({ validationStatus: 3, rejectionReason: 'nudity-detected-should-never-leak' }),
        ),
      ),
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
      expect(JSON.stringify(result.current.state)).not.toContain('nudity-detected-should-never-leak')
      expect(useCheckinStore.getState().pending).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('retry from a rejected-content terminal goes back to camera', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () => HttpResponse.json({ checkInId: 'checkin-1' }, { status: 202 })),
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(statusPayload({ validationStatus: 3 })),
      ),
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

    expect(result.current.state).toEqual({ kind: 'camera' })
  })

  it('an unrecognized 400 title or network failure falls back to a generic error state, with retry back to camera', async () => {
    const { result } = await renderInCameraState()

    server.use(
      http.post(`${baseURL}/checkins/photo`, () =>
        HttpResponse.json({ photoUrl: 'https://cdn.example.com/checkins/x.jpg' }),
      ),
      http.post(`${baseURL}/checkins`, () =>
        HttpResponse.json({ title: 'CreateCheckInCommand.SomethingElse' }, { status: 400 }),
      ),
    )

    act(() => result.current.capture())
    await waitFor(() => expect(result.current.state.kind).toBe('error'))

    act(() => result.current.retry())

    expect(result.current.state).toEqual({ kind: 'camera' })
  })
})
