import { describe, expect, it } from 'vitest'
import {
  checkinStatusSchema,
  createCheckinRequestSchema,
  createCheckinResponseSchema,
  photoUploadResponseSchema,
} from '@/shared/schemas/checkin'

describe('createCheckinRequestSchema', () => {
  const validPayload = {
    placeId: '10000000-0000-0000-0000-000000000004',
    latitude: 6.2234,
    longitude: -75.5802,
    gpsAccuracyMeters: 12.5,
    photoUrl: 'https://cdn.example.com/checkins/abc.jpg',
  }

  it('accepts the real payload shape', () => {
    expect(createCheckinRequestSchema.parse(validPayload)).toEqual(validPayload)
  })

  it('rejects a payload missing gpsAccuracyMeters', () => {
    const { gpsAccuracyMeters: _gpsAccuracyMeters, ...rest } = validPayload
    expect(() => createCheckinRequestSchema.parse(rest)).toThrow()
  })

  it('rejects a mistyped latitude (string instead of number)', () => {
    expect(() =>
      createCheckinRequestSchema.parse({ ...validPayload, latitude: '6.2234' }),
    ).toThrow()
  })
})

describe('createCheckinResponseSchema', () => {
  it('accepts { checkInId }', () => {
    expect(createCheckinResponseSchema.parse({ checkInId: 'checkin-123' })).toEqual({
      checkInId: 'checkin-123',
    })
  })

  it('rejects a response missing checkInId', () => {
    expect(() => createCheckinResponseSchema.parse({})).toThrow()
  })
})

describe('photoUploadResponseSchema', () => {
  it('accepts { photoUrl }', () => {
    expect(photoUploadResponseSchema.parse({ photoUrl: 'https://cdn.example.com/x.jpg' })).toEqual(
      { photoUrl: 'https://cdn.example.com/x.jpg' },
    )
  })

  it('rejects a response missing photoUrl', () => {
    expect(() => photoUploadResponseSchema.parse({})).toThrow()
  })
})

describe('checkinStatusSchema', () => {
  const base = {
    checkInId: 'checkin-123',
    awardStatus: 0,
    xpAwarded: 0,
    geoPointsAwarded: 0,
    rejectionReason: null,
    createdAt: '2026-08-24T00:00:00Z',
  }

  it.each([0, 1, 2, 3] as const)('accepts validationStatus=%s', (validationStatus) => {
    expect(checkinStatusSchema.parse({ ...base, validationStatus })).toMatchObject({
      validationStatus,
    })
  })

  it('rejects an out-of-range validationStatus', () => {
    expect(() => checkinStatusSchema.parse({ ...base, validationStatus: 4 })).toThrow()
  })

  it('accepts a terminal approved payload with awarded values', () => {
    const payload = { ...base, validationStatus: 2, awardStatus: 1, xpAwarded: 50, geoPointsAwarded: 10 }
    expect(checkinStatusSchema.parse(payload)).toEqual(payload)
  })

  it('rejects a payload missing createdAt', () => {
    const { createdAt: _createdAt, ...rest } = { ...base, validationStatus: 0 }
    expect(() => checkinStatusSchema.parse(rest)).toThrow()
  })

  it('rejects awardStatus=null (backend never sends it null, only rejectionReason is nullable)', () => {
    expect(() =>
      checkinStatusSchema.parse({ ...base, validationStatus: 0, awardStatus: null }),
    ).toThrow()
  })
})
