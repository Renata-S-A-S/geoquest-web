import esCommon from './es/common.json'
import enCommon from './en/common.json'

/**
 * Single shared resource bundle + namespace registry, reused by the app's
 * `i18n.ts` init and the test-only `src/test/i18n.ts` init (design D-B).
 * Each feature slice adds one import pair here and one entry in `ns`.
 */
export const resources = {
  es: { common: esCommon },
  en: { common: enCommon },
} as const

export const ns = ['common'] as const
export const defaultNS = 'common' as const
