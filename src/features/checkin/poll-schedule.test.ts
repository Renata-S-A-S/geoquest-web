import { describe, expect, it } from 'vitest'
import {
  POLL_DEADLINE_MS,
  POLL_FAST_MS,
  POLL_SLOW_MS,
  nextPollDelayMs,
} from '@/features/checkin/poll-schedule'

describe('nextPollDelayMs', () => {
  it.each([
    [0, POLL_FAST_MS],
    [29_999, POLL_FAST_MS],
    [30_000, POLL_SLOW_MS],
    [119_999, POLL_SLOW_MS],
    [120_000, null],
  ] as const)('elapsedMs=%s -> %s', (elapsedMs, expected) => {
    expect(nextPollDelayMs(elapsedMs)).toBe(expected)
  })

  it('keeps returning null well past the deadline, never resuming polling', () => {
    expect(nextPollDelayMs(POLL_DEADLINE_MS + 60_000)).toBeNull()
  })
})
