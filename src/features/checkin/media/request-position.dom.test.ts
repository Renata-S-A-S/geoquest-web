import { afterEach, describe, expect, it } from 'vitest'
import { requestPosition } from '@/features/checkin/media/request-position'
import { MediaPermissionError } from '@/features/checkin/media/capture-photo'

function stubGeolocation(impl: unknown) {
  Object.defineProperty(navigator, 'geolocation', { value: impl, configurable: true })
}

describe('requestPosition', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('resolves with latitude/longitude/gpsAccuracyMeters mapped from coords.accuracy', async () => {
    stubGeolocation({
      getCurrentPosition: (success: PositionCallback) =>
        success({
          coords: { latitude: 6.2234, longitude: -75.5802, accuracy: 12.5 },
        } as GeolocationPosition),
    })

    await expect(requestPosition()).resolves.toEqual({
      latitude: 6.2234,
      longitude: -75.5802,
      gpsAccuracyMeters: 12.5,
    })
  })

  it('rejects with MediaPermissionError("location") on PERMISSION_DENIED (code 1)', async () => {
    stubGeolocation({
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: 'denied' } as GeolocationPositionError),
    })

    const err = await requestPosition().catch((e: unknown) => e)

    expect(err).toBeInstanceOf(MediaPermissionError)
    expect((err as MediaPermissionError).device).toBe('location')
  })

  it('rejects with the original error for a non-permission geolocation failure (e.g. timeout, code 3)', async () => {
    const timeoutError = { code: 3, message: 'timeout' } as GeolocationPositionError
    stubGeolocation({
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
        error(timeoutError),
    })

    await expect(requestPosition()).rejects.toBe(timeoutError)
  })

  it('rejects when geolocation is unavailable in this browser', async () => {
    stubGeolocation(undefined)

    await expect(requestPosition()).rejects.toThrow('Geolocation is not supported')
  })

  it('passes a finite timeout to getCurrentPosition so a stuck GPS fix rejects instead of hanging forever', async () => {
    let receivedOptions: PositionOptions | undefined
    stubGeolocation({
      getCurrentPosition: (
        _success: PositionCallback,
        _error: PositionErrorCallback,
        options?: PositionOptions
      ) => {
        receivedOptions = options
      },
    })

    void requestPosition()

    expect(receivedOptions?.timeout).toBeTypeOf('number')
    expect(receivedOptions?.timeout).toBeLessThan(Infinity)
  })
})
