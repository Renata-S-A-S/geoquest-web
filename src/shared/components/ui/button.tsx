import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * Variantes tomadas 1:1 de la sección "Componentes compartidos" del design system:
 * primary, secondary, social, destructive. No inventar variantes nuevas.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-sm border-[1.5px] border-transparent px-[18px] py-2.5 font-sans text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-cream hover:bg-teal/90',
        secondary: 'border-teal text-teal bg-transparent hover:bg-teal/10',
        social: 'border-border bg-white text-ink hover:bg-paper',
        destructive: 'border-alert text-alert bg-transparent hover:bg-alert/10',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
  )
)
Button.displayName = 'Button'
