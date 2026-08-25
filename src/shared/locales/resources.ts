import esCommon from './es/common.json'
import enCommon from './en/common.json'
import esCheckin from './es/checkin.json'
import enCheckin from './en/checkin.json'
import esAuth from './es/auth.json'
import enAuth from './en/auth.json'
import esGamification from './es/gamification.json'
import enGamification from './en/gamification.json'

/**
 * Single shared resource bundle + namespace registry, reused by the app's
 * `i18n.ts` init and the test-only `src/test/i18n.ts` init (design D-B).
 * Each feature slice adds one import pair here and one entry in `ns`.
 */
export const resources = {
  es: { common: esCommon, checkin: esCheckin, auth: esAuth, gamification: esGamification },
  en: { common: enCommon, checkin: enCheckin, auth: enAuth, gamification: enGamification },
} as const

export const ns = ['common', 'checkin', 'auth', 'gamification'] as const
export const defaultNS = 'common' as const
