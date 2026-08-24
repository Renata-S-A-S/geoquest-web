import { useState } from 'react'
import { cn } from '@/shared/lib/cn'

export interface AvatarProps {
  initial: string
  /** WU10 (gamification) — optional real avatar image; falls back to `initial` when absent or on load error. */
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-[30px] w-[30px] text-xs',
  md: 'h-[38px] w-[38px] text-sm',
  lg: 'h-14 w-14 text-lg',
} as const

/**
 * Círculo de iniciales — placeholder de foto de perfil (ver Perfil / rail
 * lateral). WU10 (design decision #6): extendido con `src`/`alt`
 * OPCIONALES en vez de un componente hermano nuevo, así `rail-nav.tsx` (el
 * único consumidor existente) no cambia una sola línea. `onError` vuelve a
 * mostrar las iniciales — mismo criterio "fail closed a algo útil" que el
 * resto del sistema de diseño.
 */
export function Avatar({ initial, src, alt, size = 'md', className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(src) && !imageFailed

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal font-display font-bold text-cream',
        sizeMap[size],
        className
      )}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={alt ?? ''}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initial
      )}
    </div>
  )
}
