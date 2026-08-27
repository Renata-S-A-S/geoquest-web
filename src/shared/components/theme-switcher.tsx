import { useTranslation } from 'react-i18next'
import { Pill } from '@/shared/components/ui/pill'
import { useThemeStore } from '@/shared/stores/theme-store'
import type { ThemeMode } from '@/shared/lib/theme'

/**
 * Unlike `LANGUAGE_OPTIONS` (endonyms, never translated), theme names MUST
 * be translated — carries `common` namespace keys instead of a constant
 * label (design "theme-switcher.tsx" section).
 */
const THEME_OPTIONS = [
  { mode: 'light', labelKey: 'theme.light' },
  { mode: 'dark', labelKey: 'theme.dark' },
  { mode: 'system', labelKey: 'theme.system' },
] as const satisfies ReadonlyArray<{ mode: ThemeMode; labelKey: string }>

/**
 * `/perfil/editar` account-actions block, mounted right after
 * `LanguageSwitcher`. Persistence is `useThemeStore`'s own `zustand/persist`
 * (design D-4) — no manual `localStorage` write here.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)

  return (
    <div className="flex flex-col gap-1.5">
      <b className="font-sans text-[11px] font-bold text-ink">{t('theme.label')}</b>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('theme.label')}>
        {THEME_OPTIONS.map(({ mode: optionMode, labelKey }) => (
          <button
            key={optionMode}
            type="button"
            aria-pressed={mode === optionMode}
            onClick={() => setMode(optionMode)}
          >
            <Pill variant={mode === optionMode ? 'solid' : 'outline'}>{t(labelKey)}</Pill>
          </button>
        ))}
      </div>
    </div>
  )
}
