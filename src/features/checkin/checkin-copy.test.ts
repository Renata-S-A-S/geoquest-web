import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import {
  getCheckinRuleRejectionMessage,
  getGenericContentRejectionMessage,
} from '@/features/checkin/checkin-copy'
import type { CheckinRuleRejection } from '@/features/checkin/checkin-api'

const ALL_RULES: readonly CheckinRuleRejection[] = [
  'OutOfRadius',
  'HardBlock24Hours',
  'PlaceInactive',
  'GpsAccuracyExceeded',
  'PlaceNotFound',
]

/**
 * `getFixedT` returns a deterministic `t` bound to one language + namespace,
 * independent of the global singleton's currently active language — the
 * same pattern the functions under test are designed for (WU11 i18n
 * migration: `checkin-copy.ts` takes `t` as a parameter, not a global read).
 */
const esT = i18next.getFixedT('es', 'checkin')

describe('getCheckinRuleRejectionMessage', () => {
  it('has a non-empty message for every business rule', () => {
    for (const rule of ALL_RULES) {
      expect(getCheckinRuleRejectionMessage(esT, rule).length).toBeGreaterThan(0)
    }
  })

  it('gives each rule a distinct message (no copy-paste collisions)', () => {
    const messages = ALL_RULES.map((rule) => getCheckinRuleRejectionMessage(esT, rule))
    expect(new Set(messages).size).toBe(ALL_RULES.length)
  })

  it('translates to English when the language switches (EN-switch test)', () => {
    const enT = i18next.getFixedT('en', 'checkin')

    expect(getCheckinRuleRejectionMessage(enT, 'OutOfRadius')).toBe(
      "You're too far from the place. Get closer and try again."
    )
  })
})

describe('getGenericContentRejectionMessage', () => {
  it('is a single non-empty message, distinct from every rule-specific message', () => {
    const ruleMessages = ALL_RULES.map((rule) => getCheckinRuleRejectionMessage(esT, rule))
    const generic = getGenericContentRejectionMessage(esT)

    expect(generic.length).toBeGreaterThan(0)
    expect(ruleMessages).not.toContain(generic)
  })
})
