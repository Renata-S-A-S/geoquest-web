import type { CheckinRuleRejection } from '@/features/checkin/checkin-api'

/**
 * Rule -> user-facing Spanish copy (spec "Typed Rejection Messaging").
 * Reserved EXCLUSIVELY for synchronous 400 business-rule rejections at
 * `POST /checkins`. AI/content-based rejections (async poll
 * `validationStatus === Rejected`) MUST use `GENERIC_CONTENT_REJECTION_MESSAGE`
 * instead — `rejectionReason` is never read or rendered (design decision #5:
 * discriminate by transport, not by that string).
 */
export const CHECKIN_RULE_REJECTION_MESSAGES: Record<CheckinRuleRejection, string> = {
  OutOfRadius: 'Estás demasiado lejos del lugar. Acercate y probá de nuevo.',
  HardBlock24Hours: 'Ya hiciste check-in acá en las últimas 24 horas.',
  PlaceInactive: 'Este lugar no está disponible por ahora.',
  GpsAccuracyExceeded:
    'La señal GPS no es lo bastante precisa. Salí a un espacio abierto y reintentá.',
  PlaceNotFound: 'No encontramos este lugar.',
}

/** Generic content-moderation message — the only copy ever shown for an AI/content rejection. */
export const GENERIC_CONTENT_REJECTION_MESSAGE = 'No pudimos validar la foto.'
