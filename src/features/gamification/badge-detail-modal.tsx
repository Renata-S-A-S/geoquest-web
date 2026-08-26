import { useEffect } from 'react'
import { TornPanel } from '@/shared/components/torn-panel'
import { useActiveLocale } from '@/shared/lib/locale'
import type { BadgeAward } from '@/shared/schemas/gamification'

export interface BadgeDetailModalProps {
  badge: BadgeAward
  onClose: () => void
}

/**
 * Modal de detalle de insignia — WU10 (gamification), design decision #7.
 * `TornPanel edge="top" backing="ink"` overlay, mismo hairline estándar que
 * `ConfirmationModal`. Cierra con Esc o click en el backdrop.
 *
 * TODO(#41): el backend todavía no expone `description` ni `iconUrl` en
 * `BadgeAwardResult` (solo `name` + `awardedAtUtc`) — este modal NO debe
 * inferir ni mostrar un placeholder para esos campos hasta que el issue
 * #41 los agregue al contrato.
 */
export function BadgeDetailModal({ badge, onClose }: BadgeDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Subscribed read (design D-D) — re-renders the formatted date on language
  // change, unlike the pure `getActiveLocale()`.
  const locale = useActiveLocale()
  const awardedAt = new Date(badge.awardedAtUtc).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      data-testid="badge-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
      onClick={onClose}
    >
      <div className="relative w-[220px]" onClick={(event) => event.stopPropagation()}>
        <TornPanel
          edge="top"
          backing="ink"
          role="dialog"
          aria-modal="true"
          aria-label={badge.name}
          className="flex flex-col items-center gap-1.5 px-3.5 pb-4 pt-[18px] text-center"
        >
          <b className="font-display text-sm text-ink">{badge.name}</b>
          <span className="font-sans text-[11px] text-muted">{awardedAt}</span>
        </TornPanel>
      </div>
    </div>
  )
}
