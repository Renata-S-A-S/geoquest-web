import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MediaPermissionError,
  PhotoTooLargeError,
  UnsupportedCameraContextError,
  captureFrame,
  requestCameraStream,
  stopCameraStream,
} from '@/features/checkin/media/capture-photo'
import { MAX_PHOTO_BYTES } from '@/features/checkin/checkin-config'

function stubCanvas(blobSize: number) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback
  ) {
    callback(new Blob([new Uint8Array(blobSize)], { type: 'image/jpeg' }))
  })
}

function fakeVideo(width = 1920, height = 1080): HTMLVideoElement {
  const video = document.createElement('video')
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true })
  return video
}

describe('requestCameraStream', () => {
  afterEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Reflect.deleteProperty(navigator, 'mediaDevices')
  })

  it('throws UnsupportedCameraContextError when the context is not secure', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })

    await expect(requestCameraStream()).rejects.toBeInstanceOf(UnsupportedCameraContextError)
  })

  it('throws UnsupportedCameraContextError when navigator.mediaDevices is missing', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })

    await expect(requestCameraStream()).rejects.toBeInstanceOf(UnsupportedCameraContextError)
  })

  it('throws MediaPermissionError("camera") when getUserMedia rejects with NotAllowedError', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const notAllowed = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(notAllowed) },
      configurable: true,
    })

    const error = await requestCameraStream().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(MediaPermissionError)
    expect((error as MediaPermissionError).device).toBe('camera')
  })

  it('resolves with the stream returned by getUserMedia when granted', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const fakeStream = { getTracks: () => [] } as unknown as MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    })

    await expect(requestCameraStream()).resolves.toBe(fakeStream)
  })
})

describe('captureFrame', () => {
  afterEach(() => vi.restoreAllMocks())

  it('throws PhotoTooLargeError when the encoded blob exceeds MAX_PHOTO_BYTES', async () => {
    stubCanvas(MAX_PHOTO_BYTES + 1)

    await expect(captureFrame(fakeVideo())).rejects.toBeInstanceOf(PhotoTooLargeError)
  })

  it('resolves with a JPEG blob under the size limit', async () => {
    stubCanvas(1024)

    const blob = await captureFrame(fakeVideo())

    expect(blob.type).toBe('image/jpeg')
    expect(blob.size).toBeLessThanOrEqual(MAX_PHOTO_BYTES)
  })

  it('throws UnsupportedCameraContextError when the canvas has no 2D context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    await expect(captureFrame(fakeVideo())).rejects.toBeInstanceOf(UnsupportedCameraContextError)
  })
})

describe('stopCameraStream', () => {
  it('stops every track on the stream', () => {
    const stop1 = vi.fn()
    const stop2 = vi.fn()
    const stream = { getTracks: () => [{ stop: stop1 }, { stop: stop2 }] } as unknown as MediaStream

    stopCameraStream(stream)

    expect(stop1).toHaveBeenCalledOnce()
    expect(stop2).toHaveBeenCalledOnce()
  })
})
