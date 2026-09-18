import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MediaPermissionError,
  PhotoTooLargeError,
  captureFrame,
  requestCameraStream,
  stopCameraStream,
  type MediaPermissionDevice,
} from '@/features/checkin/media/capture-photo'
import { requestPosition, type GpsReading } from '@/features/checkin/media/request-position'
import {
  createCheckin,
  getCheckinStatus,
  mapCreateCheckinError,
  uploadCheckinPhoto,
  type CheckinRuleRejection,
} from '@/features/checkin/checkin-api'
import { nextPollDelayMs } from '@/features/checkin/poll-schedule'
import { badgeNames, diffUnlockedBadges } from '@/features/checkin/badge-diff'
import { getGamingProfile } from '@/features/gamification/gamification-api'
import { gamificationKeys } from '@/features/gamification/queries'
import { ValidationStatus } from '@/shared/schemas/checkin'
import type { GamingProfile } from '@/shared/schemas/gamification'
import { queryClient } from '@/shared/lib/query-client'
import { useCheckinStore } from '@/shared/stores/checkin-store'

export type CheckinState =
  | { kind: 'requesting-permissions' }
  | { kind: 'permission-denied'; device: MediaPermissionDevice }
  | { kind: 'camera' }
  | { kind: 'sending'; step: 'upload' | 'create' }
  | { kind: 'pending'; checkInId: string }
  | { kind: 'pending-review'; checkInId: string }
  | { kind: 'approved'; xpAwarded: number; geoPointsAwarded: number; placeName: string }
  | { kind: 'rejected-content' }
  | { kind: 'rejected-rule'; rule: CheckinRuleRejection }
  | { kind: 'error'; message: string }

/**
 * Issue #108 — the decorative half of an approved check-in: the badges this
 * check-in unlocked and the explorer's streak, both derived from a
 * `GET /gaming/profile` refetch that resolves AFTER the approval transition.
 *
 * Deliberately kept OUT of `CheckinState['approved']`: the terminal outcome
 * is settled the moment the poll returns `Approved`, and it must not wait on
 * (or be invalidated by) an optional profile read. `null` means "nothing to
 * celebrate beyond XP/GeoPoints" — a missing snapshot, a failed refetch, or
 * a refetch still in flight all land here, and all render identically.
 */
export interface CheckinCelebration {
  unlockedBadgeNames: string[]
  currentStreak: number
}

export interface UseCheckinResult {
  state: CheckinState
  videoRef: RefObject<HTMLVideoElement>
  capture: () => void
  retry: () => void
  celebration: CheckinCelebration | null
}

/**
 * WU9 (issue #9), PR3 — orchestrates the whole check-in flow: permission
 * acquisition, capture + submit, and client-limited status polling
 * (`poll-schedule.ts`). Camera/GPS access lives in `media/capture-photo.ts`
 * and `media/request-position.ts` so this hook is fully mockable without a
 * real camera or GPS (design decision #9) — `checkin-api.ts` itself is
 * NEVER mocked, only intercepted at the wire level via MSW.
 *
 * Error copy reads from the `checkin` i18n namespace (WU11): this is itself
 * a hook, so it can call `useTranslation` directly and stay reactive to
 * language changes, unlike the plain-function fallbacks in `checkin-api.ts`.
 */
/**
 * Issue #108 — the "after" half of the badge diff, plus the streak.
 *
 * Module-level on purpose: it closes over nothing from the component, so
 * `armPolling` never has to take it as a dependency. It reaches for the
 * shared `queryClient` singleton rather than `useQueryClient()` because
 * `CheckinPage` is reachable without a `QueryClientProvider` ancestor in
 * tests, exactly like this module already reaches for
 * `useCheckinStore.getState()`. `providers.tsx` mounts this same instance,
 * so the app-side cache is the one being read and refilled.
 *
 * Returns `null` on ANY failure instead of throwing: a badge line and a
 * streak are decoration on top of an already-successful check-in, and a
 * network error here must never repaint a celebration as a failure.
 */
async function fetchCelebration(
  badgeNamesBefore: string[] | null,
  checkinCreatedAt: string
): Promise<CheckinCelebration | null> {
  try {
    const profile = await queryClient.fetchQuery<GamingProfile>({
      queryKey: gamificationKeys.profile,
      queryFn: getGamingProfile,
      // Force a real read: the cached copy IS the pre-check-in snapshot
      // this diff is measured against.
      staleTime: 0,
      // One attempt. A retry chain would keep a dead request alive long
      // after the explorer left the screen.
      retry: false,
    })
    return {
      unlockedBadgeNames: diffUnlockedBadges(badgeNamesBefore, profile.badges, checkinCreatedAt),
      currentStreak: profile.currentStreak,
    }
  } catch {
    return null
  }
}

export function useCheckin(): UseCheckinResult {
  const { t } = useTranslation('checkin')
  const [state, setState] = useState<CheckinState>({ kind: 'requesting-permissions' })
  const [celebration, setCelebration] = useState<CheckinCelebration | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const positionRef = useRef<GpsReading | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)
  const acquisitionPromiseRef = useRef<Promise<void> | null>(null)

  const clearPoll = useCallback(() => {
    if (pollTimeoutRef.current !== null) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  /**
   * Issue #152 — releases the camera the moment it has no remaining job.
   * Nulling the ref is half the contract, not bookkeeping: it is what makes
   * this idempotent, so the unmount cleanup after a capture does not stop
   * the same tracks a second time.
   */
  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      stopCameraStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  /**
   * Hand-rolled recursive `setTimeout` loop around the pure
   * `nextPollDelayMs` schedule (design decision #1). Armed on entering
   * `pending`, cleared on unmount and on every terminal transition.
   */
  const armPolling = useCallback((checkInId: string) => {
    const startedAt = Date.now()

    const scheduleNext = (elapsedMs: number) => {
      const delay = nextPollDelayMs(elapsedMs)
      if (delay === null) {
        if (!unmountedRef.current) setState({ kind: 'pending-review', checkInId })
        return
      }
      pollTimeoutRef.current = setTimeout(poll, delay)
    }

    const poll = () => {
      void getCheckinStatus(checkInId)
        .then((status) => {
          if (unmountedRef.current) return
          if (status.validationStatus === ValidationStatus.Approved) {
            // Design decisions #10/#11: capture `placeName` from the store
            // BEFORE clearing it — `clearSelectedPlace()` empties
            // `selectedPlace`, so the terminal-state UI needs its own copy
            // rather than a live read at render time.
            const placeName = useCheckinStore.getState().selectedPlace?.placeName ?? ''
            // Issue #108: read the badge snapshot BEFORE clearing it, same
            // reason as `placeName` above.
            const badgeNamesBefore = useCheckinStore.getState().badgeNamesBefore
            useCheckinStore.getState().clearPending()
            useCheckinStore.getState().clearSelectedPlace()
            useCheckinStore.getState().clearBadgeNamesBefore()
            setState({
              kind: 'approved',
              xpAwarded: status.xpAwarded,
              geoPointsAwarded: status.geoPointsAwarded,
              placeName,
            })
            // `status.createdAt` is the SERVER's clock, the same one that
            // stamps `awardedAtUtc` — never the client's, which can be
            // skewed far enough to swallow or invent an unlock.
            void fetchCelebration(badgeNamesBefore, status.createdAt).then((resolved) => {
              if (!unmountedRef.current && resolved) setCelebration(resolved)
            })
            return
          }
          if (status.validationStatus === ValidationStatus.Rejected) {
            useCheckinStore.getState().clearPending()
            useCheckinStore.getState().clearSelectedPlace()
            useCheckinStore.getState().clearBadgeNamesBefore()
            setState({ kind: 'rejected-content' })
            return
          }
          if (status.validationStatus === ValidationStatus.PendingManualReview) {
            setState({ kind: 'pending-review', checkInId })
            return
          }
          scheduleNext(Date.now() - startedAt)
        })
        .catch(() => {
          // Transient network hiccup mid-poll — keep trying until the deadline.
          if (!unmountedRef.current) scheduleNext(Date.now() - startedAt)
        })
    }

    scheduleNext(0)
  }, [])

  /**
   * `acquisitionPromiseRef` makes a concurrent call reuse the in-flight
   * request instead of starting a second one. This matters beyond the
   * unmountedRef fix below: React 18 StrictMode's dev-only
   * mount->cleanup->remount cycle re-runs the mount effect (and therefore
   * this function) SYNCHRONOUSLY, before the first `getUserMedia()` call
   * has resolved — the cleanup in between can't stop it either, since
   * `streamRef.current` is still `null` at that point. Without this guard,
   * both calls independently reach `getUserMedia()` and end up requesting
   * the same physical camera twice, concurrently — most webcam drivers
   * don't serve two live captures cleanly, so the permission indicator
   * turns on but the resulting video is black/broken (reported via manual
   * testing, real hardware only — Chromium's fake-device test camera
   * happily serves concurrent consumers and can't reproduce this).
   */
  const acquirePermissions = useCallback((): Promise<void> => {
    if (acquisitionPromiseRef.current) return acquisitionPromiseRef.current
    // Issue #152: never request a second camera while the first one is
    // still held. Not every path into a terminal state runs through
    // `captureFrame` — `submitCheckin` bails out to `error` before it when
    // `selectedPlace` went stale — so without this the retry below would
    // overwrite `streamRef` and strand a live camera with nothing left to
    // stop it. Deliberately placed AFTER the re-entrancy guard: StrictMode's
    // second, synchronous call returns the in-flight promise above and never
    // reaches here, so the concurrent-acquisition fix stays intact.
    releaseStream()
    setState({ kind: 'requesting-permissions' })
    const promise = (async () => {
      try {
        const [stream, position] = await Promise.all([requestCameraStream(), requestPosition()])
        if (unmountedRef.current) {
          stopCameraStream(stream)
          return
        }
        streamRef.current = stream
        positionRef.current = position
        setState({ kind: 'camera' })
      } catch (error) {
        if (unmountedRef.current) return
        if (error instanceof MediaPermissionError) {
          setState({ kind: 'permission-denied', device: error.device })
          return
        }
        setState({ kind: 'error', message: t('errors.unexpected') })
      } finally {
        acquisitionPromiseRef.current = null
      }
    })()
    acquisitionPromiseRef.current = promise
    return promise
  }, [releaseStream, t])

  useEffect(() => {
    // Reset on every (re)mount, not just at first render: React 18
    // StrictMode's dev-only mount->cleanup->remount cycle runs this cleanup
    // once before the "real" mount, which would otherwise leave
    // unmountedRef permanently `true` and silently no-op every later state
    // update forever (the exact bug this line fixes, found via manual
    // testing — see use-checkin.dom.test.ts's StrictMode reproduction).
    unmountedRef.current = false
    void acquirePermissions()
    return () => {
      unmountedRef.current = true
      clearPoll()
      releaseStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The <video> element only mounts once `state.kind` becomes 'camera'
  // (checkin-page.tsx renders a spinner, not the <video>, for every other
  // state) — so `videoRef.current` is still null at the moment
  // `acquirePermissions` resolves and assigns `streamRef.current`. Attaching
  // the stream there was a no-op that happened to go unnoticed: this effect
  // re-runs after the 'camera' render commits the real <video> DOM node, and
  // is what actually wires the stream to the visible feed.
  useEffect(() => {
    if (state.kind === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [state.kind])

  const submitCheckin = useCallback(async () => {
    const position = positionRef.current
    // `checkin-page.tsx`'s redirect guard already blocks mounting this hook
    // without a `selectedPlace` (design decision #12), but `submitCheckin`
    // stays defensive in case the guard's snapshot goes stale mid-flow.
    const selectedPlace = useCheckinStore.getState().selectedPlace
    if (!position || !selectedPlace) {
      setState({ kind: 'error', message: t('errors.unexpected') })
      return
    }

    setState({ kind: 'sending', step: 'upload' })
    setCelebration(null)
    try {
      const photo = await captureFrame(videoRef.current as HTMLVideoElement)
      // Issue #152: the frame is a `Blob` now, so the camera has nothing
      // left to do. Waiting for unmount kept it — and the OS camera
      // indicator — live through `sending` -> `pending` -> `approved`, i.e.
      // up to the 120s polling deadline in `poll-schedule.ts`.
      releaseStream()
      const photoUrl = await uploadCheckinPhoto(photo)
      if (unmountedRef.current) return
      setState({ kind: 'sending', step: 'create' })
      const checkInId = await createCheckin({
        placeId: selectedPlace.placeId,
        latitude: position.latitude,
        longitude: position.longitude,
        gpsAccuracyMeters: position.gpsAccuracyMeters,
        photoUrl,
      })
      if (unmountedRef.current) return
      // Design decision #4: persist as soon as `checkInId` exists (the
      // `202`), not only at the poll deadline — recoverable even if the tab
      // closes mid-poll.
      useCheckinStore.getState().setPending({ checkInId, placeName: selectedPlace.placeName })
      // Issue #108: the "before" half of the badge diff, taken from the
      // React Query cache the profile screen already filled — reading it
      // costs no request, which is the whole point. No cached profile means
      // no snapshot, and the stale one from a previous check-in MUST be
      // dropped rather than reused against this one.
      const cachedProfile = queryClient.getQueryData<GamingProfile>(gamificationKeys.profile)
      if (cachedProfile) {
        useCheckinStore.getState().setBadgeNamesBefore(badgeNames(cachedProfile.badges))
      } else {
        useCheckinStore.getState().clearBadgeNamesBefore()
      }
      setState({ kind: 'pending', checkInId })
      armPolling(checkInId)
    } catch (error) {
      if (unmountedRef.current) return
      if (error instanceof PhotoTooLargeError) {
        setState({ kind: 'error', message: t('errors.photoTooLarge') })
        return
      }
      const mapped = mapCreateCheckinError(error)
      if ('rule' in mapped) {
        setState({ kind: 'rejected-rule', rule: mapped.rule })
      } else {
        setState({ kind: 'error', message: mapped.message })
      }
    }
  }, [armPolling, releaseStream, t])

  const capture = useCallback(() => {
    if (state.kind !== 'camera') return
    void submitCheckin()
  }, [state.kind, submitCheckin])

  /**
   * Issue #152 — every retry re-acquires, not just the `permission-denied`
   * one. Dropping straight back to `camera` used to work only because the
   * stream from the first attempt was still live and the `srcObject` effect
   * re-attached it; now that capture releases it, that path would render a
   * black viewfinder. Re-reading the GPS along the way is the point rather
   * than a side effect: an `OutOfRadius` rejection tells the explorer to get
   * closer, so the retry has to measure where they are now.
   */
  const retry = useCallback(() => {
    clearPoll()
    setCelebration(null)
    void acquirePermissions()
  }, [acquirePermissions, clearPoll])

  return { state, videoRef, capture, retry, celebration }
}
