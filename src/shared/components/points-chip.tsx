import { Diamond } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/cn'
import { useActiveLocale } from '@/shared/lib/locale'

export interface PointsChipProps {
  points: number
  className?: string
}

/** Chip de saldo de GeoPoints — topbar del mapa. */
export function PointsChip({ points, className }: PointsChipProps) {
  const locale = useActiveLocale()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-white px-[9px] py-1 font-mono text-[11px] font-bold text-ink',
        className
      )}
    >
      <Diamond size={12} weight="fill" className="text-coral" />
      {points.toLocaleString(locale)}
    </div>
  )
}
