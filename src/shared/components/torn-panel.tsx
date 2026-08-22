import { type HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export interface TornPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** `top`: borde rasgado arriba (modales, tarjetas). `right`: borde rasgado a la derecha (panel lateral de auth). */
  edge?: 'top' | 'right'
}

/**
 * Pieza de firma visual #1 del design system: "borde rasgado" — clip-path irregular
 * tipo página arrancada. Es la única pieza de "apuesta" del sistema; los valores del
 * polígono son exactamente los de geoquest-design-system-v1.html (.torn-top / .torn-right).
 * No usar radios redondeados perfectos en su lugar.
 */
const clipPaths = {
  top: 'polygon(0% 4%,6% 1%,12% 4%,18% 1%,24% 3%,30% 1%,36% 4%,42% 1%,48% 3%,54% 1%,60% 4%,66% 1%,72% 3%,78% 1%,84% 4%,90% 1%,96% 3%,100% 1%,100% 100%,0% 100%)',
  right:
    'polygon(0% 0%,92% 0%,97% 4%,90% 8%,97% 12%,90% 16%,97% 20%,90% 24%,97% 28%,90% 32%,97% 36%,90% 40%,97% 44%,90% 48%,97% 52%,90% 56%,97% 60%,90% 64%,97% 68%,90% 72%,97% 76%,90% 80%,97% 84%,90% 88%,97% 92%,92% 96%,0% 100%)',
} as const

export function TornPanel({ edge = 'top', className, style, ...props }: TornPanelProps) {
  return (
    <div
      className={cn('relative bg-white', className)}
      style={{ clipPath: clipPaths[edge], ...style }}
      {...props}
    />
  )
}
