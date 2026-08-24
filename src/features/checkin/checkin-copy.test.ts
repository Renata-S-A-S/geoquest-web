import { describe, expect, it } from 'vitest'
import {
  CHECKIN_RULE_REJECTION_MESSAGES,
  GENERIC_CONTENT_REJECTION_MESSAGE,
} from '@/features/checkin/checkin-copy'
import type { CheckinRuleRejection } from '@/features/checkin/checkin-api'

const ALL_RULES: readonly CheckinRuleRejection[] = [
  'OutOfRadius',
  'HardBlock24Hours',
  'PlaceInactive',
  'GpsAccuracyExceeded',
  'PlaceNotFound',
]

describe('CHECKIN_RULE_REJECTION_MESSAGES', () => {
  it('has a non-empty message for every business rule', () => {
    for (const rule of ALL_RULES) {
      expect(CHECKIN_RULE_REJECTION_MESSAGES[rule].length).toBeGreaterThan(0)
    }
  })

  it('gives each rule a distinct message (no copy-paste collisions)', () => {
    const messages = ALL_RULES.map((rule) => CHECKIN_RULE_REJECTION_MESSAGES[rule])
    expect(new Set(messages).size).toBe(ALL_RULES.length)
  })
})

describe('GENERIC_CONTENT_REJECTION_MESSAGE', () => {
  it('is a single non-empty message, distinct from every rule-specific message', () => {
    const ruleMessages = Object.values(CHECKIN_RULE_REJECTION_MESSAGES)
    expect(GENERIC_CONTENT_REJECTION_MESSAGE.length).toBeGreaterThan(0)
    expect(ruleMessages).not.toContain(GENERIC_CONTENT_REJECTION_MESSAGE)
  })
})
