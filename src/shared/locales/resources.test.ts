import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { resources, ns, defaultNS } from './resources'

/** Recursively collects dotted key paths from a nested translation object. */
function collectKeyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, nested]) =>
    collectKeyPaths(nested, prefix ? `${prefix}.${key}` : key)
  )
}

describe('i18n resources', () => {
  it('registers the common namespace as the default namespace', () => {
    expect(ns).toContain('common')
    expect(defaultNS).toBe('common')
  })

  it('has an identical key set between es and en for every namespace', () => {
    for (const namespace of ns) {
      const esKeys = collectKeyPaths(resources.es[namespace]).sort()
      const enKeys = collectKeyPaths(resources.en[namespace]).sort()

      expect(enKeys).toEqual(esKeys)
    }
  })

  it('resolves a known key to the real Spanish literal under the default test language', () => {
    expect(i18next.t('nav.map')).toBe('Mapa')
  })

  it('resolves the same key to the real English literal after switching language', async () => {
    await i18next.changeLanguage('en')

    expect(i18next.t('nav.map')).toBe('Map')

    await i18next.changeLanguage('es')
  })

  it('falls back to the es value when a key is missing from the active language', async () => {
    i18next.addResource('es', 'common', 'onlyInEs', 'Valor exclusivo de es')
    await i18next.changeLanguage('en')

    expect(i18next.t('onlyInEs')).toBe('Valor exclusivo de es')

    await i18next.changeLanguage('es')
  })
})
