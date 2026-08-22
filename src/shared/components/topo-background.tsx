import { cn } from '@/shared/lib/cn'

export interface TopoBackgroundProps {
  /** `light`: trazo oscuro sobre fondo claro. `dark`: trazo claro sobre fondo oscuro (ej. rail, panel de auth). */
  tone?: 'light' | 'dark'
  className?: string
}

/**
 * Pieza de firma visual #3: "textura topográfica" — curvas de nivel casi invisibles
 * de fondo, confirmado para identidad "outdoor/aventura". Usar como capa absoluta
 * detrás del contenido (onboarding, panel lateral de auth), nunca como elemento
 * interactivo.
 */
export function TopoBackground({ tone = 'light', className }: TopoBackgroundProps) {
  const stroke = tone === 'light' ? 'rgba(16,38,43,0.08)' : 'rgba(255,249,242,0.1)'
  return (
    <svg
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M-10,20 Q30,6 70,20 T150,14" stroke={stroke} strokeWidth={0.6} fill="none" />
      <path d="M-10,55 Q30,41 70,55 T150,49" stroke={stroke} strokeWidth={0.6} fill="none" />
    </svg>
  )
}
