import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Pill } from '@/shared/components/ui/pill'
import { Toast } from '@/shared/components/toast'
import { useOnboardingStore } from '@/shared/stores/onboarding-store'
import { INTEREST_CATALOG } from '@/features/gamification/interests-catalog'
import { useUpdateProfile } from '@/features/gamification/queries'
import { mapProfilePatchError } from '@/features/gamification/profile-edit-api'
import type { Category } from '@/shared/schemas/gamification'

/**
 * `/onboarding/intereses` — explorer-onboarding-settings PR5. Last
 * onboarding step, mounted inside `ProtectedRoute` but outside `AppShell`
 * (the `/checkin` precedent — full-bleed, no nav), the same route slot PR4
 * deliberately left unwired. At least one interest is mandatory (spec
 * "Mandatory Interest Selection"): the continue button stays disabled at 0
 * selections rather than only validating on submit.
 *
 * Reuses the existing `useUpdateProfile()` / `PATCH /explorers/me` mutation
 * (same transport `/perfil/editar` already exercises) instead of a bespoke
 * onboarding endpoint. `onboarding-store`'s completion flag (D2) is written
 * ONLY after that write succeeds, matching spec "Persistence failure keeps
 * user on the step" — a failed PATCH shows the error and leaves the user on
 * this step with their selection intact.
 */
export function InterestsStepPage() {
  const { t } = useTranslation('onboarding')
  const { t: tGamification } = useTranslation('gamification')
  const navigate = useNavigate()
  const setHasCompletedOnboarding = useOnboardingStore((state) => state.setHasCompletedOnboarding)
  const [selectedInterests, setSelectedInterests] = useState<Category[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const updateProfile = useUpdateProfile()

  const toggleInterest = (value: Category) => {
    setSelectedInterests((previous) =>
      previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value]
    )
  }

  const handleContinue = () => {
    setFormError(null)
    updateProfile.mutate(
      { interests: selectedInterests, avatarChange: { kind: 'none' } },
      {
        onSuccess: () => {
          setHasCompletedOnboarding(true)
          navigate('/')
        },
        onError: (error) => setFormError(mapProfilePatchError(error, tGamification).message),
      }
    )
  }

  return (
    <div className="flex h-dvh flex-col gap-5 bg-cream px-6 py-10">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="font-display text-2xl text-ink">{t('interests.title')}</h1>
        <p className="font-sans text-sm text-muted">{t('interests.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-wrap content-start justify-center gap-2">
        {INTEREST_CATALOG.map((entry) => {
          const selected = selectedInterests.includes(entry.value)
          return (
            <button
              key={entry.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleInterest(entry.value)}
            >
              <Pill variant={selected ? 'solid' : 'outline'}>
                {tGamification(entry.labelKey, { ns: 'gamification' })}
              </Pill>
            </button>
          )
        })}
      </div>

      {formError && <Toast variant="error" message={formError} />}

      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={selectedInterests.length === 0 || updateProfile.isPending}
        onClick={handleContinue}
      >
        {updateProfile.isPending ? t('interests.submitting') : t('interests.continue')}
      </Button>
    </div>
  )
}
