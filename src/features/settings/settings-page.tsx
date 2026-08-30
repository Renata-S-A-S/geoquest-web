import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { ThemeSwitcher } from '@/shared/components/theme-switcher'
import { ConfirmationModal } from '@/shared/components/confirmation-modal'
import { Button } from '@/shared/components/ui/button'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useSettingsStore } from '@/shared/stores/settings-store'
import { cn } from '@/shared/lib/cn'

interface PreferenceToggleProps {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}

/**
 * A binary preference switch — unlike `ThemeSwitcher`/`LanguageSwitcher`
 * (multi-option pill groups), notification/privacy prefs (D6) are single
 * booleans, so a `role="switch"` toggle is the correct ARIA pattern
 * (WAI-ARIA switch, not a group of pressable pills).
 */
function PreferenceToggle({ label, checked, onChange }: PreferenceToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-6 w-11 shrink-0 items-center rounded-full border border-border p-0.5 transition-colors',
        checked ? 'justify-end bg-teal' : 'justify-start bg-surface-raised'
      )}
    >
      <span className="h-5 w-5 rounded-full bg-paper" />
    </button>
  )
}

/**
 * `/configuracion` — explorer-onboarding-settings PR7 full assembly (design
 * D5/D6/D7, tasks Phase 7). Extends PR6's scaffold (title + `LanguageSwitcher`)
 * with `ThemeSwitcher` (D7 — now available on this branch after the
 * theme-system branch merged, resolving PR6's blocking risk), the
 * notification/privacy toggles wired to `settings-store.ts` (D6), a T&C
 * link (placeholder `#` href — target URL still pending PO), and logout.
 *
 * Logout mirrors `edit-profile-page.tsx`'s `ConfirmationModal` +
 * `queryClient.clear()` pattern exactly (spec "Single Logout Surface" /
 * "Logout from Configuración clears session") — no explicit `navigate()`
 * call: `ProtectedRoute` already redirects once `isAuthenticated` flips to
 * false, since `/configuracion` lives inside that guard. PR8 will remove
 * the now-redundant logout affordance from `edit-profile-page.tsx`.
 */
export function SettingsPage() {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const logout = useAuthStore((state) => state.logout)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled)
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled)
  const privacyAnalytics = useSettingsStore((state) => state.privacyAnalytics)
  const setPrivacyAnalytics = useSettingsStore((state) => state.setPrivacyAnalytics)

  const handleConfirmLogout = () => {
    setConfirmOpen(false)
    logout()
    queryClient.clear()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <b className="font-display text-base text-ink">{t('title')}</b>

      <ThemeSwitcher />
      <LanguageSwitcher />

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-[11px] font-bold text-ink">
            {t('notifications.label')}
          </span>
          <PreferenceToggle
            label={t('notifications.toggle')}
            checked={notificationsEnabled}
            onChange={setNotificationsEnabled}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-[11px] font-bold text-ink">{t('privacy.label')}</span>
          <PreferenceToggle
            label={t('privacy.toggle')}
            checked={privacyAnalytics}
            onChange={setPrivacyAnalytics}
          />
        </div>
      </div>

      <a href="#" className="font-sans text-[11px] font-bold text-teal">
        {t('terms')}
      </a>

      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
          {t('logout')}
        </Button>
      </div>

      {confirmOpen && (
        <ConfirmationModal
          title={t('logoutConfirmTitle')}
          description={t('logoutConfirmDescription')}
          confirmLabel={t('logout')}
          onConfirm={handleConfirmLogout}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
