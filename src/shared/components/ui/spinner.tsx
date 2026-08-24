import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'

export interface SpinnerProps {
  size?: number
  className?: string
}

/**
 * Anillo girando — estado "Enviando" de check-in (ver design system, sección
 * "checkin", estado 2). `animate-spin` es una animación default de Tailwind,
 * no hace falta declarar un keyframe propio.
 */
export function Spinner({ size = 34, className }: SpinnerProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-[3px] border-border border-t-teal',
        className
      )}
      style={{ width: size, height: size }}
      role="status"
      aria-label={t('aria.loading')}
    />
  )
}
