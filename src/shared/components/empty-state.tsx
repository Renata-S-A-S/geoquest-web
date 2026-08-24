import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/cn'

export interface EmptyStateProps {
  icon: Icon
  title: string
  description: string
  className?: string
}

/** Estado vacío — borde punteado, ícono + título + descripción muted. */
export function EmptyState({
  icon: IconComponent,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('rounded-md border border-dashed border-border p-4 text-center', className)}>
      <IconComponent size={20} weight="fill" className="mx-auto text-muted" />
      <div className="mt-1 font-sans text-xs font-bold text-ink">{title}</div>
      <div className="font-sans text-[11px] text-muted">{description}</div>
    </div>
  )
}
