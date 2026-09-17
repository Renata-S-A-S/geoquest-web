/**
 * Rewards — Colombian peso formatting for `RewardSummaryResult
 * .EstimatedValueCop` (a backend `decimal`).
 *
 * Uses `Number.prototype.toLocaleString`, the repo precedent for
 * locale-aware numbers (`shared/components/points-chip.tsx`,
 * `app/layout/rail-nav.tsx`, `features/gamification/profile-view.tsx`),
 * rather than a standalone `Intl.NumberFormat` instance.
 *
 * `maximumFractionDigits: 0` drops the cents: COP has no circulating
 * fractional unit, so prices are always shown as whole pesos even though
 * the wire value may carry decimals.
 *
 * Callers pass the active locale (see `shared/lib/locale`) so the grouping
 * separators follow the explorer's language, not the process default.
 */
export function formatCop(value: number, locale: string): string {
  return value.toLocaleString(locale, {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
}
