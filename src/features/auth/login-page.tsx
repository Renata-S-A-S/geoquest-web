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
import { loginRequest, mapLoginError } from './auth-api'
import { createLoginSchema, type LoginFormValues } from './login-schema'

/**
 * Pantalla de login — WU8 (UI, issue #8) + WU6 (cliente API real, issue #6).
 *
 * Decisión del founder (revisión de WU8): "Iniciar sesión" y "Continuar con
 * Google" son dos acciones separadas, no un único botón. "Iniciar sesión" es
 * el `type="submit"` real del formulario email/contraseña — ahora pega de
 * verdad a `POST /auth/login`; "Continuar con Google" sigue siendo un stub
 * (ver comentario en su handler, más abajo).
 */
export function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(createLoginSchema(t)) })

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (tokens) => {
      setFormError(null)
      login(tokens)
      navigate('/')
    },
    onError: (error) => {
      setFormError(mapLoginError(error, t))
    },
  })

  const onSubmit = (values: LoginFormValues) => {
    setFormError(null)
    loginMutation.mutate(values)
  }

  const handleGoogleContinue = () => {
    // TODO(OAuth — fuera de alcance de WU6): esto sigue siendo 100% stub, no
    // hay integración real de Google todavía. Antes de WU6, este handler
    // llamaba a un `login()` sin argumentos (stub de WU7); ahora que el
    // store guarda tokens reales, acá simulamos una sesión con valores
    // obviamente falsos SOLO para no romper el click-through de demo. Cuando
    // se implemente OAuth de verdad, casi seguro no encaja en este mismo
    // `login(tokens)` de email/contraseña — hace falta su propio flujo de
    // redirect + callback — así que no tomar esto como plantilla.
    console.log('[login] click en "Continuar con Google", pendiente de integrar OAuth')
    login({
      accessToken: 'stub-google-access-token',
      accessTokenExpiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(),
      refreshToken: 'stub-google-refresh-token',
      refreshTokenExpiresAtUtc: new Date(Date.now() + 86_400_000).toISOString(),
    })
    navigate('/')
  }

  return (
    <AuthLayout
      title={t('title')}
      tagline={t('tagline')}
      coordinates="6.2442°N · 75.5812°W"
      city="MED"
      neighborhood="LAURELES"
      footer={
        <div className="pt-1">
          <span className="block text-center font-sans text-xs text-muted md:hidden">
            {t('signup.promptShort')}{' '}
            <a href="/registro" className="font-bold text-teal hover:underline">
              {t('signup.cta')}
            </a>
          </span>
          <span className="hidden text-center font-sans text-xs text-muted lg:block">
            {t('signup.promptLong')}{' '}
            <a href="/registro" className="font-bold text-teal hover:underline">
              {t('signup.cta')}
            </a>
          </span>
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <InputField
          label={t('form.emailLabel')}
          type="email"
          autoComplete="email"
          hint={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label={t('form.passwordLabel')}
          type="password"
          autoComplete="current-password"
          hint={errors.password?.message}
          {...register('password')}
        />
        <a
          href="/forgot-password"
          className="self-end font-sans text-[11px] font-bold text-teal hover:underline"
        >
          {t('forgotPasswordCta')}
        </a>
        {formError && <Toast variant="error" message={formError} />}
        <Button
          type="submit"
          variant="primary"
          disabled={loginMutation.isPending}
          className="mt-1 w-full"
        >
          {loginMutation.isPending ? t('form.submitPending') : t('form.submit')}
        </Button>
      </form>

      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="font-sans text-[11px] text-muted">{t('divider')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="social" className="w-full" onClick={handleGoogleContinue}>
        {t('google')}
      </Button>
    </AuthLayout>
  )
}
