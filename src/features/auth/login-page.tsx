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
 * "Iniciar sesión" es el `type="submit"` real del formulario
 * email/contraseña, pega a `POST /auth/login`. El botón "Continuar con
 * Google" fue eliminado (product decision 1215.2 / spec 1217): era un
 * bypass de autenticación que escribía tokens falsos en el store. Vuelve en
 * un cambio posterior cuando el backend exponga un callback de OAuth que la
 * SPA pueda consumir (geoquest issue 129).
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
    </AuthLayout>
  )
}
