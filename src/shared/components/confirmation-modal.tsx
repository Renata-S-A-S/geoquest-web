import type { ReactNode } from 'react'
import { TornPanel } from './torn-panel'
import { Button } from '@/shared/components/ui/button'

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
 * borde rasgado. En mobile (`<lg`) el panel queda anclado abajo (bottom
 * sheet); desde `lg` (mismo corte que `AppShell`/`RailNav`) queda centrado.
 * Ver sección "Componentes compartidos" del design system.
 */
export function ConfirmationModal({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmationModalProps): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-6 lg:items-center">
      <div className="relative w-[260px] lg:w-[340px]">
        <TornPanel edge="top" backing="ink" className="flex flex-col gap-3 px-3.5 pb-3 pt-[18px]">
          <b className="font-display text-sm">{title}</b>
          <p className="-mt-2 font-sans text-[11px] text-muted">{description}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              className="flex-1"
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
