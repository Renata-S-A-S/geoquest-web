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
 * Proyección pura del badge: nombre, descripción y fecha, sin copy propia.
 * La descripción llega del servidor (backend issue #41, cerrado el
 * 2026-08-24) y se muestra tal cual, incluso bajo locale `en`, porque es
 * texto libre en español guardado en la base y no una clave traducible —
 * mismo criterio que `auth-api.ts` con el `detail` de ProblemDetails.
 * `badge.iconUrl` se parsea pero no se renderiza: es NULL en las 7 filas
 * sembradas, así que no hay ícono que mostrar todavía.
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
      {/* 220px alcanzaba para un nombre corto; una frase completa de
          descripción se partía en demasiadas líneas, de ahí los 280px. */}
      <div className="relative w-[280px]" onClick={(event) => event.stopPropagation()}>
        <TornPanel
          edge="top"
          backing="ink"
          role="dialog"
          aria-modal="true"
          aria-label={badge.name}
          className="flex flex-col items-center gap-1.5 px-3.5 pb-4 pt-[18px] text-center"
        >
          <b className="font-display text-sm text-ink">{badge.name}</b>
          <p className="font-sans text-[12px] leading-snug text-ink">{badge.description}</p>
          <span className="font-sans text-[11px] text-muted">{awardedAt}</span>
        </TornPanel>
      </div>
    </div>
  )
}
