import { JPEG_QUALITY, MAX_EDGE_PX, MAX_PHOTO_BYTES } from '@/features/checkin/checkin-config'

/**
 * Camera + frame-capture adapter — WU9 (issue #9), PR3. Isolated in its own
 * module so `useCheckin` can `vi.mock` it entirely in hook tests (design
 * decision #9): real `getUserMedia` streaming and `canvas.toBlob` frame
 * capture cannot be exercised in jsdom (no real camera, no 2D canvas
 * context), so this file's actual browser behavior is only verifiable via
 * the manual device checklist (task 3.12). What IS unit-testable here — and
 * covered by `capture-photo.dom.test.ts` — is the permission/error
 * classification logic and the size-assert branch.
 */

export type MediaPermissionDevice = 'camera' | 'location'

/** Thrown when the user denies camera or location permission. */
export class MediaPermissionError extends Error {
  readonly device: MediaPermissionDevice

  constructor(device: MediaPermissionDevice, message?: string) {
    super(message ?? `Permission denied: ${device}`)
    this.name = 'MediaPermissionError'
    this.device = device
  }
}

/** Thrown when the browser/context has no usable camera API at all. */
export class UnsupportedCameraContextError extends Error {
  constructor(message = 'Camera is not supported in this context') {
    super(message)
    this.name = 'UnsupportedCameraContextError'
  }
}

/** Thrown when the encoded JPEG exceeds `MAX_PHOTO_BYTES` (design decision #7). */
export class PhotoTooLargeError extends Error {
  constructor(message = 'Captured photo exceeds the maximum allowed size') {
    super(message)
    this.name = 'PhotoTooLargeError'
  }
}

/**
 * Requests the front-facing camera stream. `window.isSecureContext === false`
 * or a missing `navigator.mediaDevices` short-circuits to
 * `UnsupportedCameraContextError` (e.g. non-HTTPS, unsupported browser) —
 * this branch IS unit-testable, unlike the real streaming behavior.
 */
export async function requestCameraStream(): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new UnsupportedCameraContextError()
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      throw new MediaPermissionError('camera', error.message)
    }
    throw error
  }
}

/** Stops every track — call on unmount or after a terminal check-in outcome. */
export function stopCameraStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop())
}

/**
 * Draws the current video frame onto an offscreen canvas, downscales to
 * `MAX_EDGE_PX` on the longest edge, and encodes as JPEG at `JPEG_QUALITY`.
 * Asserts the result never exceeds `MAX_PHOTO_BYTES` (cheap insurance — a
 * 1600px JPEG cannot plausibly reach 10MB, see design decision #7).
 */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const { videoWidth, videoHeight } = video
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(videoWidth, videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(videoWidth * scale)
  canvas.height = Math.round(videoHeight * scale)

  const context = canvas.getContext('2d')
  if (!context) {
    throw new UnsupportedCameraContextError('Canvas 2D context is not available')
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob) {
    throw new UnsupportedCameraContextError('Failed to encode the captured frame')
  }
  if (blob.size > MAX_PHOTO_BYTES) {
    throw new PhotoTooLargeError()
  }
  return blob
}
