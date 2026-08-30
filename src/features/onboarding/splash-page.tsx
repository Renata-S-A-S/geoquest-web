import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Stamp } from '@/shared/components/stamp'
import { TopoBackground } from '@/shared/components/topo-background'
import { useOnboardingStore } from '@/shared/stores/onboarding-store'

/**
 * Pantalla de marca — explorer-onboarding-settings PR4. Primera pantalla
 * que ve un visitante sin sesión que nunca completó el onboarding (design
 * decision D1, wired en `ProtectedRoute`). Full-bleed sobre `bg-ink` con
 * `TopoBackground` (misma pieza de firma visual que el panel de marca de
 * `AuthLayout`), monta como hermana pública del árbol con `ProtectedRoute`
 * — mismo precedente que `/login` — no dentro de `AppShell`.
 *
 * Dos CTAs (design "Data Flow"):
 * - "Crear cuenta" → `/registro`, no toca el flag de onboarding — ese flag
 *   se escribe recién en el paso de intereses tras el registro (PR5).
 * - "Ya tengo cuenta" → escribe `hasCompletedOnboarding=true` ANTES de
 *   navegar (D2): un usuario que vuelve en un dispositivo nuevo no es un
 *   first-run, así que su próximo `ProtectedRoute` sin sesión debe mandar a
 *   `/login`, no de vuelta acá.
 */
export function SplashPage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setHasCompletedOnboarding = useOnboardingStore((state) => state.setHasCompletedOnboarding)

  const handleHasAccount = () => {
    setHasCompletedOnboarding(true)
    navigate('/login')
  }

  return (
    <div className="relative flex h-dvh flex-col items-center justify-between overflow-hidden bg-ink px-6 py-10 text-cream">
      <TopoBackground tone="dark" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Stamp size={64} color="coral">
          MED
        </Stamp>
        <h1 className="font-display text-3xl text-cream">{t('splash.wordmark')}</h1>
        <p className="max-w-xs font-sans text-sm leading-snug text-cream/70">
          {t('splash.tagline')}
        </p>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={() => navigate('/registro')}
        >
          {t('splash.createAccount')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full border-cream text-cream hover:bg-cream/10"
          onClick={handleHasAccount}
        >
          {t('splash.hasAccount')}
        </Button>
      </div>
    </div>
  )
}
