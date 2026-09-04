import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { AuthLayout } from '@/shared/components/auth-layout'
import { InputField } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Toast } from '@/shared/components/toast'
import { resetPasswordRequest, mapResetPasswordError } from './auth-api'
import { createResetPasswordSchema, type ResetPasswordFormValues } from './reset-password-schema'

/**
 * Pantalla de restablecer contraseña. El link del email lo arma el backend
 * como `{FrontendBaseUrl}{ResetPath}?email={email}&token={token}` — `email`
 * y `token` llegan por query string, nunca como campos del formulario.
 * `useSearchParams` (no un parseo manual de `location.search`) es obligatorio
 * acá: el token es base64 y puede contener `+`/`/`, y `useSearchParams` ya
 * hace el URL-decoding correcto.
 *
 * Si falta `email` o `token` (link roto, copiado a medias, o visita directa
 * a la ruta), se muestra un estado de error en vez del formulario — nunca se
 * intenta pegarle a `POST /auth/password/reset` sin esos dos valores.
 *
 * Un reset exitoso NO auto-autentica (a diferencia de login/register): el
 * endpoint no devuelve tokens, así que acá solo se muestra confirmación y un
 * link a `/login`.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''
  const hasValidLink = email.length > 0 && token.length > 0
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(createResetPasswordSchema(t)) })

  const resetPasswordMutation = useMutation({
    mutationFn: resetPasswordRequest,
    onSuccess: () => {
      setFormError(null)
    },
    onError: (error) => {
      setFormError(mapResetPasswordError(error, t))
    },
  })

  const onSubmit = (values: ResetPasswordFormValues) => {
    setFormError(null)
    resetPasswordMutation.mutate({ email, token, newPassword: values.newPassword })
  }

  return (
    <AuthLayout
      title={t('resetPassword.title')}
      tagline={t('tagline')}
      coordinates="6.2442°N · 75.5812°W"
      city="MED"
      neighborhood="LAURELES"
      footer={
        <span className="block pt-1 text-center font-sans text-xs text-muted">
          <a href="/login" className="font-bold text-teal hover:underline">
            {t('resetPassword.backToLogin')}
          </a>
        </span>
      }
    >
      {!hasValidLink ? (
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <Toast variant="error" message={t('resetPassword.invalidLink.title')} />
          <span className="font-sans text-xs text-muted">
            {t('resetPassword.invalidLink.description')}
          </span>
          <a href="/forgot-password" className="font-bold text-teal hover:underline">
            {t('resetPassword.requestNewLink')}
          </a>
        </div>
      ) : resetPasswordMutation.isSuccess ? (
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <Toast variant="success" message={t('resetPassword.confirmation')} />
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <InputField
            label={t('resetPassword.form.newPasswordLabel')}
            type="password"
            autoComplete="new-password"
            hint={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <InputField
            label={t('resetPassword.form.confirmPasswordLabel')}
            type="password"
            autoComplete="new-password"
            hint={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {formError && <Toast variant="error" message={formError} />}
          <Button
            type="submit"
            variant="primary"
            disabled={resetPasswordMutation.isPending}
            className="mt-1 w-full"
          >
            {resetPasswordMutation.isPending
              ? t('resetPassword.form.submitPending')
              : t('resetPassword.form.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
