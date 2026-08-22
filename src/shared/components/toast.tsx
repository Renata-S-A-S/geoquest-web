import { WarningCircle } from '@phosphor-icons/react'
import { Stamp } from './stamp'
import { Pill } from '@/shared/components/ui/pill'

export interface ToastProps {
  variant: 'success' | 'error'
  message: string
}

/** Toast — variante success usa el sello en miniatura como ícono; error usa WarningCircle. */
export function Toast({ variant, message }: ToastProps) {
  if (variant === 'success') {
    return (
      <Pill variant="success">
        <Stamp size={16} color="teal">
          {''}
        </Stamp>
        {message}
      </Pill>
    )
  }
  return (
    <Pill variant="alert">
      <WarningCircle size={14} weight="fill" />
      {message}
    </Pill>
  )
}
