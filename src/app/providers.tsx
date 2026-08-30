import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { IconContext } from '@phosphor-icons/react'
import { queryClient } from '@/shared/lib/query-client'
import { ThemeEffects } from '@/app/theme-effects'

/**
 * Peso de ícono global: fill — reemplaza el look outline por defecto de
 * @phosphor-icons/react para calzar con la identidad "redondeada y rellena".
 *
 * `<ThemeEffects />` is a SIBLING here, not a hook called directly in this
 * component's body: calling a subscribing hook here would re-render the
 * entire tree — including the permanently-mounted, WebGL-backed `MapPage` —
 * on every theme change (design D-7).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeEffects />
      <IconContext.Provider value={{ weight: 'fill' }}>{children}</IconContext.Provider>
    </QueryClientProvider>
  )
}
