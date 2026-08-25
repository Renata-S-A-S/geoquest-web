import { X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * WU4 (issue #4) — pure presentational half. Reuses `PendingCheckinBanner`'s
 * markup/classes and its shared `common:aria.dismiss` dismiss convention so
 * the app has one consistent dismissible-banner pattern.
 */
export function UpdatePromptBanner({
  onUpdate,
  onDismiss,
}: {
  onUpdate: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-x-3 top-3 z-50 flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2.5 shadow-md">
      <p className="font-sans text-xs text-ink">
        <b className="text-teal">{t('notifications.updateAvailable')}</b>
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onUpdate}
          className="font-sans text-xs font-semibold text-teal"
        >
          {t('notifications.update')}
        </button>
        <button
          type="button"
          aria-label={t('aria.dismiss')}
          onClick={onDismiss}
          className="text-muted"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}

/**
 * Container — talks to the Workbox-generated service worker via
 * `useRegisterSW` (aliased to `src/test/pwa-register-stub.ts` under Vitest,
 * see `vitest.config.ts`). Renders nothing unless a new version is waiting
 * (`needRefresh`). Dismissing sets `needRefresh` back to false — the user
 * keeps working on the current version and the prompt reappears on the next
 * load if the waiting worker is still there; nothing is force-reloaded.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <UpdatePromptBanner
      onUpdate={() => {
        void updateServiceWorker(true)
      }}
      onDismiss={() => setNeedRefresh(false)}
    />
  )
}
