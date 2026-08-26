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
import { ValidationStatus } from '@/shared/schemas/checkin'
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

export interface UseCheckinResult {
  state: CheckinState
  videoRef: RefObject<HTMLVideoElement>
  capture: () => void
  retry: () => void
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
export function useCheckin(): UseCheckinResult {
  const { t } = useTranslation('checkin')
  const [state, setState] = useState<CheckinState>({ kind: 'requesting-permissions' })
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
            useCheckinStore.getState().clearPending()
            useCheckinStore.getState().clearSelectedPlace()
            setState({
              kind: 'approved',
              xpAwarded: status.xpAwarded,
              geoPointsAwarded: status.geoPointsAwarded,
              placeName,
            })
            return
          }
          if (status.validationStatus === ValidationStatus.Rejected) {
            useCheckinStore.getState().clearPending()
            useCheckinStore.getState().clearSelectedPlace()
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
  }, [t])

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
      if (streamRef.current) {
        stopCameraStream(streamRef.current)
        streamRef.current = null
      }
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
    try {
      const photo = await captureFrame(videoRef.current as HTMLVideoElement)
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
  }, [armPolling, t])

  const capture = useCallback(() => {
    if (state.kind !== 'camera') return
    void submitCheckin()
  }, [state.kind, submitCheckin])

  const retry = useCallback(() => {
    clearPoll()
    if (state.kind === 'permission-denied') {
      void acquirePermissions()
      return
    }
    setState({ kind: 'camera' })
  }, [state.kind, acquirePermissions, clearPoll])

  return { state, videoRef, capture, retry }
}
