import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { resources, ns, defaultNS } from '@/shared/locales/resources'

/**
 * App-wide i18next singleton. Resources are statically bundled JSON imports
 * (design D-A) so `init()` resolves synchronously and the dictionaries work
 * offline — `i18next-http-backend` was rejected because VitePWA's
 * `workbox.globPatterns` does not cover lazily-fetched `/locales/**.json`.
 *
 * Side-effect module: imported once from `main.tsx` only. Never import this
 * from a test — the test environment has its own sync init in
 * `src/test/i18n.ts` (design D-C); importing this one too would double-init
 * the singleton.
 */
void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns,
    defaultNS,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      // Library default — set explicitly so the persistence contract (design
      // decision, language-switcher requirement) is readable at the call
      // site and survives a future library default change.
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  })

export default i18next
