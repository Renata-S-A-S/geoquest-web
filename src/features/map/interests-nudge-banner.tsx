import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from '@phosphor-icons/react'
import { useExplorerProfile } from '@/features/gamification/queries'

/**
 * `/` (map) — explorer-onboarding-settings PR5, design decision D8
 * (PO-confirmed). `interests-step-page.tsx` normally guarantees an
 * authenticated explorer reaches the map with ≥1 interest, but a returning
 * user can still land here with `interests: []` (cleared onboarding state,
 * or deselected everything on `/perfil/editar`, which stays out of scope to
 * change). Rather than silently accepting that gap, a soft, dismissible
 * nudge links to `/perfil/editar` where interest editing already lives —
 * purely informational, never blocking navigation. Dismiss is per-session
 * only (component state, not persisted): reopening the map in a new
 * session shows it again if the condition still holds.
 *
 * Reads the same `GET /explorers/me` query `/perfil/editar` already uses
 * (`useExplorerProfile`, TanStack dedupes on the shared key) — no bespoke
 * fetch, no prop drilling from `map-page.tsx`.
 */
export function InterestsNudgeBanner() {
  const { t } = useTranslation('map')
  const [dismissed, setDismissed] = useState(false)
  const { data } = useExplorerProfile()

  if (dismissed || !data || data.interests.length > 0) return null

  return (
    <div
      data-testid="interests-nudge-banner"
      className="mx-4 mt-3 flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2"
    >
      <div className="flex flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="font-sans text-[10.5px] text-muted">{t('interestsNudge.message')}</span>
        <Link
          to="/perfil/editar"
          className="shrink-0 font-sans text-[10.5px] font-bold text-teal hover:underline"
        >
          {t('interestsNudge.cta')}
        </Link>
      </div>
      <button
        type="button"
        aria-label={t('interestsNudge.dismiss')}
        onClick={() => setDismissed(true)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper"
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  )
}
