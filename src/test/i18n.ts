import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources, ns, defaultNS } from '@/shared/locales/resources'

/**
 * Test-only i18n init — imported for side effects by `setup.ts` and
 * `setup-dom.ts` only, never by app code. No `LanguageDetector`: the
 * detector would read the CI runner's `navigator.language` before `lng: 'es'`
 * takes effect, which is exactly the nondeterminism this init exists to
 * avoid (design D-C, spec "Deterministic Test Environment Language").
 */
void i18next.use(initReactI18next).init({
  resources,
  ns,
  defaultNS,
  lng: 'es',
  fallbackLng: 'es',
  supportedLngs: ['es', 'en'],
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18next
