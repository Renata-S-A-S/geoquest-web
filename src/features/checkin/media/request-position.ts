import { MediaPermissionError } from '@/features/checkin/media/capture-photo'

/** GPS reading already mapped to the field names `createCheckin` expects. */
export interface GpsReading {
  latitude: number
  longitude: number
  gpsAccuracyMeters: number
}

/**
 * Wraps `navigator.geolocation.getCurrentPosition` in a Promise and maps
 * `coords.accuracy` to `gpsAccuracyMeters` (design doc "media/request-position.ts").
 * `PERMISSION_DENIED` (code 1) becomes a `MediaPermissionError('location')` so
 * `useCheckin` can enter `permission-denied`; any other geolocation error
 * (position unavailable, timeout) rejects with the original error untouched.
 */
export function requestPosition(): Promise<GpsReading> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          gpsAccuracyMeters: position.coords.accuracy,
        })
      },
      (error) => {
        if (error.code === 1) {
          reject(new MediaPermissionError('location', error.message))
          return
        }
        reject(error)
      },
    )
  })
}
