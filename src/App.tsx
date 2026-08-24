import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/routes'
import { PwaUpdatePrompt } from './app/components/pwa-update-prompt'

export function App() {
  return (
    <AppProviders>
      <PwaUpdatePrompt />
      <RouterProvider router={router} />
    </AppProviders>
  )
}
