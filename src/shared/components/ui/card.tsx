import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

/** Card genérica: fondo blanco, borde 1px, radio md — ver `.card` del design system. */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-md border border-border bg-white px-3 py-2.5', className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'
