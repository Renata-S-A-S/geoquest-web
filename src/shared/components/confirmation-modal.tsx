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
 * Modal de confirmación — fondo oscurecido + TornPanel apilado sobre un bloque
 * sólido desplazado 8px (efecto "pila de hojas"). Ver sección "Componentes
 * compartidos" del design system.
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
    <div className="flex items-center justify-center rounded-lg bg-ink/55 p-6">
      <div className="relative w-[220px]">
        <div className="absolute inset-x-0 top-2 bottom-0 rounded-b-sm bg-ink" />
        <TornPanel edge="top" className="relative flex flex-col gap-3 px-3.5 pb-3 pt-[18px]">
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
