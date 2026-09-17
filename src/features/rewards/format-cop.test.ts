import { describe, expect, it } from 'vitest'
import { formatCop } from '@/features/rewards/format-cop'

/**
 * Rewards — COP currency formatting (read layer). `RewardSummaryResult
 * .EstimatedValueCop` is a backend `decimal`, rendered as whole pesos: COP
 * has no circulating fractional unit, so the fraction digits are dropped.
 *
 * ICU hazard: `es-CO` + `COP` separates the currency symbol from the digits
 * with a non-breaking space (U+00A0, or U+202F on newer ICU builds), and the
 * symbol itself is not stable across Node/ICU versions (`es-CO` emits `$`,
 * `en-US` emits `COP`). Asserting a literal like `'$ 25.000'` therefore
 * breaks across Node versions. Every assertion below strips whitespace or
 * matches digits by regex instead.
 */

/** Removes every space variant ICU may emit between symbol and digits. */
function withoutWhitespace(value: string): string {
  return value.replace(/[\s\u00A0\u202F]/g, '')
}

describe('formatCop', () => {
  it('groups digits with dots and emits a currency marker without a decimal fraction for es-CO', () => {
    const formatted = withoutWhitespace(formatCop(25000, 'es-CO'))

    expect(formatted).toContain('25.000')
    expect(formatted).not.toMatch(/25\.000[.,]\d/)
    expect(formatted.replace('25.000', '')).not.toBe('')
  })

  it('regroups the same amount for en-US', () => {
    const formatted = withoutWhitespace(formatCop(25000, 'en-US'))

    expect(formatted).toContain('25,000')
    expect(formatted).not.toMatch(/25,000[.,]\d/)
    expect(formatted.replace('25,000', '')).not.toBe('')
  })

  it('formats a zero amount instead of returning an empty string', () => {
    const formatted = withoutWhitespace(formatCop(0, 'es-CO'))

    expect(formatted).not.toBe('')
    expect(formatted).toMatch(/0/)
  })
})
