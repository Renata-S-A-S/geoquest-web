import type { ReactNode } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { TornPanel } from './torn-panel'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/cn'

export interface ConfirmationModalProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal de confirmación — fondo oscurecido a pantalla completa (`fixed
 * inset-0`, mismo patrón que `badge-detail-modal.tsx`) + TornPanel con el
 * hairline de tinta estándar (`backing="ink"`, ver `torn-panel.tsx`) en el
 * borde rasgado. En mobile (`<lg`) es un bottom sheet borde a borde, pegado
 * al fondo real de la pantalla (sin margen); desde `lg` (mismo corte que
 * `AppShell`/`RailNav`) es una tarjeta centrada más ancha, con más aire
 * interno. El botón de confirmación destructivo se ve sólido (no outline)
 * acá para marcar con claridad cuál es la acción principal — desviación
 * deliberada del `Button` variant="destructive" base (que sigue outline
 * en el resto de la app), no un cambio a la variante compartida.
 * Ver sección "Componentes compartidos" del design system.
 */
export function ConfirmationModal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmationModalProps): ReactNode {
  const { t } = useTranslation()
  // `cancelLabel` cannot default in the signature to a translated value — a
  // default parameter is evaluated once, outside any hook, and would freeze
  // at whatever language was active on first render. Read it in the body
  // instead so it re-resolves on every language change.
  const cancel = cancelLabel ?? t('actions.cancel')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 lg:items-center">
      <div className="w-full lg:w-[460px]">
        <TornPanel
          edge="top"
          backing="ink"
          className="px-6 pt-8 pb-[34px] lg:px-9 lg:pt-10 lg:pb-8"
        >
          <div className="flex items-center gap-3">
            {destructive && (
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-alert">
                <SignOut size={20} weight="fill" className="text-alert" />
              </span>
            )}
            <b className="font-display text-lg text-ink lg:text-[21px]">{title}</b>
          </div>
          <p className="mt-3 font-sans text-[12.5px] text-muted lg:mt-3.5 lg:text-[13px]">
            {description}
          </p>
          <div className="mt-6 flex gap-2.5 lg:mt-7 lg:gap-3">
            <Button
              variant="secondary"
              className="flex-1 py-[13px] lg:py-3.5 lg:text-[13.5px]"
              onClick={onCancel}
            >
              {cancel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              className={cn(
                'flex-1 py-[13px] lg:py-3.5 lg:text-[13.5px]',
                destructive && 'border-alert bg-alert text-cream hover:bg-alert/90'
              )}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </TornPanel>
      </div>
    </div>
  )
}
