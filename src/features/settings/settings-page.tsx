import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/shared/components/language-switcher'

/**
 * `/configuracion` — explorer-onboarding-settings PR6, scaffold scope only
 * (design D6/D7, tasks 6.3/6.4). Design D7 (PO-confirmed 2026-08-29): both
 * `ThemeSwitcher` and `LanguageSwitcher` relocate here as Configuración's
 * single preferences surface, alongside notification/privacy prefs, a T&C
 * link, and logout — all of which land in PR7 (tasks Phase 7).
 *
 * `ThemeSwitcher` is deliberately NOT mounted in this slice: it and its
 * backing `theme-store.ts` exist only on the separate, unmerged
 * `feat/frontend-theme-system-f-switcher-ui` branch, not on `main` or this
 * branch. Wiring it here would mean fabricating a substitute component,
 * which this batch's instructions explicitly disallow. This is flagged as
 * a blocking risk in apply-progress — the switcher must be wired in a
 * follow-up once that branch merges (or the component is otherwise made
 * available on this branch).
 */
export function SettingsPage() {
  const { t } = useTranslation('settings')

  return (
    <div className="flex flex-col gap-4 p-4">
      <b className="font-display text-base text-ink">{t('title')}</b>
      <LanguageSwitcher />
    </div>
  )
}
