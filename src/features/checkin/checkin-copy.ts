import type { TFunction } from 'i18next'
import type { CheckinRuleRejection } from '@/features/checkin/checkin-api'

/**
 * Rule -> `checkin` namespace translation key (spec "Typed Rejection
 * Messaging"). Reserved EXCLUSIVELY for synchronous 400 business-rule
 * rejections at `POST /checkins`. AI/content-based rejections (async poll
 * `validationStatus === Rejected`) MUST use `getGenericContentRejectionMessage`
 * instead — `rejectionReason` is never read or rendered (design decision #5:
 * discriminate by transport, not by that string).
 *
 * Exposed as `t()`-backed functions rather than a static `Record`: a plain
 * object literal of strings is resolved once at module load and can never
 * react to a later `i18next.changeLanguage()` call (WU11 i18n migration).
 * Callers pass in the `t` from their own `useTranslation('checkin')` so the
 * returned message stays in sync with the component's active language.
 */
const RULE_MESSAGE_KEY: Record<CheckinRuleRejection, string> = {
  OutOfRadius: 'rejection.outOfRadius',
  HardBlock24Hours: 'rejection.hardBlock24Hours',
  PlaceInactive: 'rejection.placeInactive',
  GpsAccuracyExceeded: 'rejection.gpsAccuracyExceeded',
  PlaceNotFound: 'rejection.placeNotFound',
}

export function getCheckinRuleRejectionMessage(t: TFunction, rule: CheckinRuleRejection): string {
  return t(RULE_MESSAGE_KEY[rule])
}

/** Generic content-moderation message — the only copy ever shown for an AI/content rejection. */
export function getGenericContentRejectionMessage(t: TFunction): string {
  return t('rejection.contentGeneric')
}
