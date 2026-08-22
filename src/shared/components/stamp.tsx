import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export interface StampProps {
  /** Texto corto del sello, ej. "MED", "1° PASO" — usar <br/> para dos líneas cortas. */
  children: ReactNode
  size?: number
  color?: 'coral' | 'teal'
  className?: string
}

/**
 * Pieza de firma visual #2: "sello de expedición/barrio" — reemplaza badges circulares
 * genéricos o el sello de pasaporte (territorio trillado). Círculo con doble borde,
 * rotado -9deg. Se usa tanto para insignias de gamification como para el sello de
 * ciudad/barrio en onboarding y auth.
 */
export function Stamp({ children, size = 46, color = 'coral', className }: StampProps) {
  return (
    <span
      className={cn(
        'flex shrink-0 -rotate-[9deg] items-center justify-center rounded-full text-center leading-[1.15]',
        color === 'coral' ? 'border-coral text-coral' : 'border-teal text-teal',
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(5, size * 0.17),
        borderWidth: size < 30 ? 1.5 : 2,
        borderStyle: 'double',
      }}
    >
      {children}
    </span>
  )
}
