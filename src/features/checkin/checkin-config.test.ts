import { describe, expect, it } from 'vitest'
import {
  JPEG_QUALITY,
  MAX_EDGE_PX,
  MAX_PHOTO_BYTES,
  SEED_PLACE_ID,
  SEED_PLACE_NAME,
} from '@/features/checkin/checkin-config'

describe('checkin-config', () => {
  it('resolves the seeded demo place by default (no env override set in this test run)', () => {
    expect(SEED_PLACE_ID).toBe('10000000-0000-0000-0000-000000000004')
    expect(SEED_PLACE_NAME).toBe('El Cielo')
  })

  it('exposes the photo encoding constants from design decision #7', () => {
    expect(MAX_EDGE_PX).toBe(1600)
    expect(JPEG_QUALITY).toBe(0.85)
    expect(MAX_PHOTO_BYTES).toBe(10 * 1024 * 1024)
  })
})
