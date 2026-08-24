import i18next from 'i18next'
import { useTranslation } from 'react-i18next'

const LOCALE_BY_LANGUAGE: Record<string, string> = { es: 'es-CO', en: 'en-US' }

/**
 * `es` -> `es-CO` (design D-E): the backend's ASP.NET `Accept-Language`
 * provider does parent-culture fallback (`es-CO` -> `es`), and a bare `es`
 * would discard region info and fork "current locale" into two notions.
 */
export const FALLBACK_LOCALE = 'es-CO'

function toLocale(lng: string | undefined): string {
  return LOCALE_BY_LANGUAGE[lng ?? ''] ?? FALLBACK_LOCALE
}

/**
 * Pure read — for non-React callers only (interceptors, plain modules,
 * tests). Does NOT re-render on language change; never use inside a
 * component that renders locale-formatted values (spec: "Locale-Aware
 * Formatting"). Use `useActiveLocale()` there instead.
 */
export function getActiveLocale(): string {
  return toLocale(i18next.resolvedLanguage ?? i18next.language)
}

/**
 * Subscribed read — MUST be used inside components (design D-D).
 * `resolvedLanguage` (not bare `i18next.language`) because
 * `nonExplicitSupportedLngs: true` can leave `language` at `es-419` while
 * `resolvedLanguage` correctly resolves to `es`.
 */
export function useActiveLocale(): string {
  const { i18n } = useTranslation()
  return toLocale(i18n.resolvedLanguage ?? i18n.language)
}
