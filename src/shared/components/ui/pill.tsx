import { forwardRef, type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * Pill de categoría / interés / estado. Variantes vistas en el design system:
 * - tint: tag de categoría, ej. "Café" (fondo surface-teal, texto teal)
 * - solid: interés seleccionado (fondo teal, texto cream)
 * - outline: interés no seleccionado (borde, texto muted)
 * - alert: toast de error (fondo surface-alert, texto/borde alert)
 */
const pillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-lg px-[11px] py-[5px] font-sans text-[11px] font-bold',
  {
    variants: {
      variant: {
        tint: 'bg-surface-teal text-teal',
        solid: 'bg-teal text-cream',
        outline: 'border border-border text-muted',
        alert: 'border border-alert bg-surface-alert text-alert',
        success: 'border-[1.5px] border-teal bg-white text-ink',
      },
    },
    defaultVariants: {
      variant: 'tint',
    },
  }
)

export interface PillProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {}

export const Pill = forwardRef<HTMLSpanElement, PillProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(pillVariants({ variant }), className)} {...props} />
  )
)
Pill.displayName = 'Pill'
