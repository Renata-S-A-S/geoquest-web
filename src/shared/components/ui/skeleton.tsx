import { cn } from '@/shared/lib/cn'

/** Bloque de carga — ver sección "Skeleton" del design system. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-surface-skeleton', className)} />
}
