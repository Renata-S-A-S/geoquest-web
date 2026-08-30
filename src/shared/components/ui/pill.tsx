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
        // Dark-mode override (founder-approved, post-review): the dark
        // `surface-teal` token is only ~1.06:1 against `surface-raised` —
        // two near-identical dark teal tones that make the tint pill nearly
        // invisible on every card/panel it renders in (all 6
        // `variant="tint"` call sites share that exact `bg-surface-raised`
        // container). `dark:bg-teal dark:text-on-brand` reuses the existing
        // `solid` variant's already-established dark palette instead of
        // inventing a new combination. Light mode is untouched.
        tint: 'bg-surface-teal text-teal dark:bg-teal dark:text-on-brand',
        solid: 'bg-teal text-on-brand',
        outline: 'border border-border text-muted',
        alert: 'border border-alert bg-surface-alert text-alert',
        success: 'border-[1.5px] border-teal bg-surface-raised text-ink',
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
