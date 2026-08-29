import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { AuthLayout } from '@/shared/components/auth-layout'
import { InputField } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Toast } from '@/shared/components/toast'
import { useAuthStore } from '@/shared/stores/auth-store'
import { requestPosition } from '@/features/checkin/media/request-position'
import type { RegisterRequest } from '@/shared/schemas/auth'
import { registerRequest, mapRegisterError } from './auth-api'
import { createRegisterSchema, type RegisterFormValues } from './register-schema'

/**
 * Local GPS-affordance state — deliberately separate from React Hook Form's
 * state (D3, design decision): the reading is not a form field, it is an
 * optional enrichment merged into the submit payload only when present.
 */
type GpsStatus =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'captured'; latitude: number; longitude: number }
  | { kind: 'denied' }

/**
 * Pantalla de registro — explorer-onboarding-settings PR3. Mirrors
 * `login-page.tsx`'s shell/transport pattern (`AuthLayout`, RHF + zod,
 * TanStack Query mutation, `mapRegisterError` for user-facing copy) with two
 * deltas: (1) an explicit "usar mi ubicación" affordance per D3 — GPS is
 * NEVER requested on mount, only on this button's click, and a grant/deny/
 * dismiss never blocks submission; (2) a successful response feeds
 * `useAuthStore.login(tokens)` exactly like login, because `registerRequest`
 * returns the same `AuthResponse` shape (auto-authenticate on register).
 */
export function RegisterPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [formError, setFormError] = useState<string | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>({ kind: 'idle' })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(createRegisterSchema(t)) })

  const registerMutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (tokens) => {
      setFormError(null)
      login(tokens)
      navigate('/onboarding/intereses')
    },
    onError: (error) => {
      setFormError(mapRegisterError(error, t))
    },
  })

  const handleUseLocation = async () => {
    setGpsStatus({ kind: 'capturing' })
    try {
      const reading = await requestPosition()
      setGpsStatus({ kind: 'captured', latitude: reading.latitude, longitude: reading.longitude })
    } catch {
      // Denial/timeout/unsupported all degrade the same way here: GPS is
      // optional enrichment, never a blocker (D3, spec scenario "Location
      // denied does not block registration").
      setGpsStatus({ kind: 'denied' })
    }
  }

  const onSubmit = (values: RegisterFormValues) => {
    setFormError(null)
    const payload: RegisterRequest = {
      username: values.username,
      email: values.email,
      password: values.password,
      ...(gpsStatus.kind === 'captured'
        ? { latitude: gpsStatus.latitude, longitude: gpsStatus.longitude }
        : {}),
    }
    registerMutation.mutate(payload)
  }

  return (
    <AuthLayout
      title={t('register.title')}
      tagline={t('tagline')}
      coordinates="6.2442°N · 75.5812°W"
      city="MED"
      neighborhood="LAURELES"
      footer={
        <span className="block pt-1 text-center font-sans text-xs text-muted">
          {t('register.footer.prompt')}{' '}
          <a href="/login" className="font-bold text-teal hover:underline">
            {t('register.footer.cta')}
          </a>
        </span>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <InputField
          label={t('register.form.usernameLabel')}
          type="text"
          autoComplete="username"
          hint={errors.username?.message}
          {...register('username')}
        />
        <InputField
          label={t('register.form.emailLabel')}
          type="email"
          autoComplete="email"
          hint={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label={t('register.form.passwordLabel')}
          type="password"
          autoComplete="new-password"
          hint={errors.password?.message}
          {...register('password')}
        />
        <InputField
          label={t('register.form.confirmPasswordLabel')}
          type="password"
          autoComplete="new-password"
          hint={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleUseLocation}
            disabled={gpsStatus.kind === 'capturing'}
          >
            {gpsStatus.kind === 'capturing'
              ? t('register.location.capturing')
              : t('register.location.cta')}
          </Button>
          {gpsStatus.kind === 'captured' && (
            <span className="font-mono text-[10px] text-teal">
              {t('register.location.captured')}
            </span>
          )}
          {gpsStatus.kind === 'denied' && (
            <span className="font-mono text-[10px] text-muted">
              {t('register.location.denied')}
            </span>
          )}
        </div>

        {formError && <Toast variant="error" message={formError} />}
        <Button
          type="submit"
          variant="primary"
          disabled={registerMutation.isPending}
          className="mt-1 w-full"
        >
          {registerMutation.isPending
            ? t('register.form.submitPending')
            : t('register.form.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
