import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { AuthLayout } from '@/shared/components/auth-layout'
import { InputField } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Toast } from '@/shared/components/toast'
import { forgotPasswordRequest, mapForgotPasswordError } from './auth-api'
import { createForgotPasswordSchema, type ForgotPasswordFormValues } from './forgot-password-schema'

/**
 * Pantalla de "olvidé mi contraseña". Mirrors `login-page.tsx`'s shell
 * (`AuthLayout`, RHF + zod, TanStack Query mutation) pero con una diferencia
 * deliberada de UX de seguridad: `POST /auth/password/forgot` SIEMPRE
 * responde 200 OK, exista o no la cuenta (anti account-enumeration), así que
 * `onSuccess` nunca debe leerse como "el correo existe" — solo reemplaza el
 * formulario por un mensaje neutral que no confirma ni niega nada.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(createForgotPasswordSchema(t)) })

  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPasswordRequest,
    onSuccess: () => {
      setFormError(null)
    },
    onError: (error) => {
      setFormError(mapForgotPasswordError(error, t))
    },
  })

  const onSubmit = (values: ForgotPasswordFormValues) => {
    setFormError(null)
    forgotPasswordMutation.mutate(values)
  }

  return (
    <AuthLayout
      title={t('forgotPassword.title')}
      tagline={t('tagline')}
      coordinates="6.2442°N · 75.5812°W"
      city="MED"
      neighborhood="LAURELES"
      footer={
        <span className="block pt-1 text-center font-sans text-xs text-muted">
          <a href="/login" className="font-bold text-teal hover:underline">
            {t('forgotPassword.backToLogin')}
          </a>
        </span>
      }
    >
      {forgotPasswordMutation.isSuccess ? (
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <Toast variant="success" message={t('forgotPassword.confirmation')} />
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <p className="font-sans text-xs text-muted">{t('forgotPassword.description')}</p>
          <InputField
            label={t('forgotPassword.form.emailLabel')}
            type="email"
            autoComplete="email"
            hint={errors.email?.message}
            {...register('email')}
          />
          {formError && <Toast variant="error" message={formError} />}
          <Button
            type="submit"
            variant="primary"
            disabled={forgotPasswordMutation.isPending}
            className="mt-1 w-full"
          >
            {forgotPasswordMutation.isPending
              ? t('forgotPassword.form.submitPending')
              : t('forgotPassword.form.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
