import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { FALLBACK_LOCALE, getActiveLocale } from './locale'

describe('getActiveLocale', () => {
  it('resolves the default test language (es) to the es-CO region locale', () => {
    expect(getActiveLocale()).toBe('es-CO')
  })

  it('resolves en to en-US after changing the active language', async () => {
    await i18next.changeLanguage('en')

    expect(getActiveLocale()).toBe('en-US')

    await i18next.changeLanguage('es')
  })

  it('falls back to FALLBACK_LOCALE for a resolved language with no locale mapping', () => {
    // i18next's own supportedLngs/fallbackLng machinery would normalize an
    // unsupported `changeLanguage` call back to 'es' before getActiveLocale
    // ever saw it, so this simulates the unmapped case directly on the
    // singleton's `resolvedLanguage` field instead.
    const original = i18next.resolvedLanguage
    i18next.resolvedLanguage = 'de'

    expect(getActiveLocale()).toBe(FALLBACK_LOCALE)

    i18next.resolvedLanguage = original
  })
})
