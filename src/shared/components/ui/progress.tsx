import { cn } from '@/shared/lib/cn'

export interface ProgressProps {
  value: number // 0-100
  className?: string
  /** WU10 (gamification) — optional `aria-valuetext` override, e.g. "Nivel máximo" at max level so screen readers don't announce a phantom next threshold. */
  valueText?: string
}

/** Barra de progreso de XP — ver sección Perfil ("320 / 500 XP"). */
export function Progress({ value, className, valueText }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-surface-mint dark:bg-surface-raised',
        className
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
    >
      <div className="h-full bg-teal transition-[width]" style={{ width: `${clamped}%` }} />
    </div>
  )
}
