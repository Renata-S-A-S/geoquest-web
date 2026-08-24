import { useTranslation } from 'react-i18next'
import { Pill } from '@/shared/components/ui/pill'

/** Endonyms — deliberately constants, never dictionary keys. */
const LANGUAGE_OPTIONS = [
  { lng: 'es', label: 'Español' },
  { lng: 'en', label: 'English' },
] as const

/**
 * `/perfil/editar` account-actions block. Persistence is the language
 * detector's `caches: ['localStorage']` config (see `shared/lib/i18n.ts`) —
 * deliberately no manual `localStorage.setItem` here.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const active = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="flex flex-col gap-1.5">
      <b className="font-sans text-[11px] font-bold text-ink">{t('language.label')}</b>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('language.label')}>
        {LANGUAGE_OPTIONS.map(({ lng, label }) => (
          <button
            key={lng}
            type="button"
            aria-pressed={active === lng}
            onClick={() => void i18n.changeLanguage(lng)}
          >
            <Pill variant={active === lng ? 'solid' : 'outline'}>{label}</Pill>
          </button>
        ))}
      </div>
    </div>
  )
}
