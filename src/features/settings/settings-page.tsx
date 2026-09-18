import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trash } from '@phosphor-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { ThemeSwitcher } from '@/shared/components/theme-switcher'
import { ConfirmationModal } from '@/shared/components/confirmation-modal'
import { Toast } from '@/shared/components/toast'
import { Button } from '@/shared/components/ui/button'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useSettingsStore } from '@/shared/stores/settings-store'
import { cn } from '@/shared/lib/cn'
import { requestAccountDeletion } from '@/features/settings/account-deletion-api'

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
 * link to `/terminos` (structural placeholder page — legal copy still
 * pending from Legal, see `terms-page.tsx`), and logout.
 *
 * Logout mirrors `edit-profile-page.tsx`'s `ConfirmationModal` +
 * `queryClient.clear()` pattern exactly (spec "Single Logout Surface" /
 * "Logout from Configuración clears session") — no explicit `navigate()`
 * call: `ProtectedRoute` already redirects once `isAuthenticated` flips to
 * false, since `/configuracion` lives inside that guard. PR8 will remove
 * the now-redundant logout affordance from `edit-profile-page.tsx`.
 *
 * Account deletion (#110, Ley 1581 habeas data) reuses that same
 * teardown: `DELETE /explorers/me` answers 204, then `logout()` +
 * `queryClient.clear()` with no `navigate()`. Because the teardown unmounts
 * this tree immediately, any success message rendered here would die with it
 * — so the grace-window explanation lives in the `ConfirmationModal`
 * description, shown BEFORE confirming. The copy promises deactivation and
 * reactivation on the next login, never erasure and never a date:
 * `ExplorerErasureOptions.ErasureEnabled` defaults to false, so the sweep
 * runs but never anonymizes. There is no cancellation endpoint either
 * (cancelling is implicit on the next successful login), so no
 * "cancel deletion" affordance is rendered anywhere.
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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletionFailed, setDeletionFailed] = useState(false)

  const handleConfirmLogout = () => {
    setConfirmOpen(false)
    logout()
    queryClient.clear()
  }

  // Every failure status (409 `Explorer.AlreadyDeleted`, 404, 400) collapses
  // into the same outcome for the explorer — the account was NOT deactivated
  // — so there is one inline error and, critically, no `logout()`. Swallowing
  // it would leave them believing a deactivation that never happened.
  const deleteAccountMutation = useMutation({
    mutationFn: requestAccountDeletion,
    onSuccess: () => {
      logout()
      queryClient.clear()
    },
    onError: () => {
      setDeletionFailed(true)
    },
  })

  const handleConfirmDeletion = () => {
    setDeleteConfirmOpen(false)
    setDeletionFailed(false)
    deleteAccountMutation.mutate()
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

      <Link to="/terminos" className="w-fit font-sans text-[11px] font-bold text-teal">
        {t('terms')}
      </Link>

      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
          {t('logout')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="font-sans text-[11px] font-bold text-ink">
          {t('deleteAccount.heading')}
        </span>
        <p className="font-sans text-[11px] text-muted">{t('deleteAccount.description')}</p>
        {deletionFailed && <Toast variant="error" message={t('deleteAccount.error')} />}
        <Button
          type="button"
          variant="destructive"
          className="w-fit"
          disabled={deleteAccountMutation.isPending}
          onClick={() => setDeleteConfirmOpen(true)}
        >
          {t('deleteAccount.action')}
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

      {deleteConfirmOpen && (
        <ConfirmationModal
          icon={Trash}
          destructive
          title={t('deleteAccount.confirmTitle')}
          description={t('deleteAccount.confirmDescription')}
          confirmLabel={t('deleteAccount.action')}
          onConfirm={handleConfirmDeletion}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  )
}
