import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '@/shared/components/auth-layout'
import { InputField } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { useAuthStore } from '@/shared/stores/auth-store'
import { loginSchema, type LoginFormValues } from './login-schema'

/**
 * Pantalla de login — WU8 (issue #8). Solo UI + validación cliente: no hay
 * cliente Axios todavía (eso es WU6), así que ambos handlers quedan stubbeados.
 *
 * Decisión del founder (revisión de WU8): "Iniciar sesión" y "Continuar con
 * Google" son dos acciones separadas, no un único botón. "Iniciar sesión" es
 * el `type="submit"` real del formulario usuario/contraseña; "Continuar con
 * Google" es un botón aparte (variant `social`) con su propio handler — no
 * dispara el submit del formulario ni valida esos campos.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = (values: LoginFormValues) => {
    // TODO(WU6): reemplazar por la llamada real al cliente Axios cuando exista
    // (issue #6, aún no implementado). Por ahora solo confirmamos que la
    // validación cliente funciona y disparamos el stub de auth (WU7) para
    // que el redirect de rutas protegidas sea probable end-to-end.
    console.log('[login] valores validados, pendiente de integrar API', values)
    login()
    navigate('/')
  }

  const handleGoogleContinue = () => {
    // TODO(WU6): reemplazar por el flujo real de OAuth con Google cuando exista
    // el cliente Axios/backend (issue #6). Acción independiente del formulario
    // de usuario/contraseña — no lo valida ni lo envía. Mismo stub de auth
    // (WU7) que el submit del formulario.
    console.log('[login] click en "Continuar con Google", pendiente de integrar OAuth')
    login()
    navigate('/')
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      tagline="Explorá Medellín. Ganá en el camino."
      coordinates="6.2442°N · 75.5812°W"
      city="MED"
      neighborhood="LAURELES"
      footer={
        <div className="pt-1">
          <span className="block text-center font-sans text-xs text-muted md:hidden">
            ¿Nuevo?{' '}
            <a href="/registro" className="font-bold text-teal hover:underline">
              Crear cuenta
            </a>
          </span>
          <span className="hidden text-center font-sans text-xs text-muted lg:block">
            ¿Nuevo por acá?{' '}
            <a href="/registro" className="font-bold text-teal hover:underline">
              Crear cuenta
            </a>
          </span>
        </div>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <InputField
          label="Usuario o correo"
          type="text"
          autoComplete="username"
          hint={errors.identifier?.message}
          {...register('identifier')}
        />
        <InputField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          hint={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-1 w-full">
          Iniciar sesión
        </Button>
      </form>

      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="font-sans text-[11px] text-muted">o</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="social" className="w-full" onClick={handleGoogleContinue}>
        Continuar con Google
      </Button>
    </AuthLayout>
  )
}
