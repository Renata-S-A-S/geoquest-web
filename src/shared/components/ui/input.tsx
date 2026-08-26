import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

/**
 * Input con label arriba, caja de 36px y borde de 1px — ver sección "Inputs"
 * del design system (campo "Nombre de usuario" / "Contraseña").
 */
export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, hint, className, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <div className="flex w-full flex-col gap-1">
        <label htmlFor={inputId} className="font-sans text-[11px] font-bold text-ink">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-9 rounded-xs border border-border bg-surface-raised px-2.5 font-sans text-xs text-ink',
            'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/40',
            className
          )}
          {...props}
        />
        {hint && <span className="font-mono text-[10px] text-muted">{hint}</span>}
      </div>
    )
  }
)
InputField.displayName = 'InputField'
