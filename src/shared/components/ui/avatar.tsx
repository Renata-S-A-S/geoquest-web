import { cn } from '@/shared/lib/cn'

export interface AvatarProps {
  initial: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-[30px] w-[30px] text-xs',
  md: 'h-[38px] w-[38px] text-sm',
  lg: 'h-14 w-14 text-lg',
} as const

/** Círculo de iniciales — placeholder de foto de perfil (ver Perfil / rail lateral). */
export function Avatar({ initial, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-teal font-display font-bold text-cream',
        sizeMap[size],
        className
      )}
    >
      {initial}
    </div>
  )
}
