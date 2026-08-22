import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IconContext } from '@phosphor-icons/react'

const queryClient = new QueryClient()

/**
 * Peso de ícono global: fill — reemplaza el look outline por defecto de
 * @phosphor-icons/react para calzar con la identidad "redondeada y rellena".
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <IconContext.Provider value={{ weight: 'fill' }}>{children}</IconContext.Provider>
    </QueryClientProvider>
  )
}
