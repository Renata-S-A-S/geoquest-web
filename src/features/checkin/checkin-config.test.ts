import { describe, expect, it } from 'vitest'
import { JPEG_QUALITY, MAX_EDGE_PX, MAX_PHOTO_BYTES } from '@/features/checkin/checkin-config'

describe('checkin-config', () => {
  it('exposes the photo encoding constants from design decision #7', () => {
    expect(MAX_EDGE_PX).toBe(1600)
    expect(JPEG_QUALITY).toBe(0.85)
    expect(MAX_PHOTO_BYTES).toBe(10 * 1024 * 1024)
  })
})
