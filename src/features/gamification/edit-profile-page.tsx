import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Avatar } from '@/shared/components/ui/avatar'
import { InputField } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Pill } from '@/shared/components/ui/pill'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Toast } from '@/shared/components/toast'
import { ConfirmationModal } from '@/shared/components/confirmation-modal'
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { useAuthStore } from '@/shared/stores/auth-store'
import { usernameCooldown } from '@/features/gamification/username-cooldown'
import { INTEREST_CATALOG } from '@/features/gamification/interests-catalog'
import { useExplorerProfile, useUpdateProfile } from '@/features/gamification/queries'
import { mapProfilePatchError } from '@/features/gamification/profile-edit-api'
import type { AvatarChange, Category, ExplorerProfileResponse } from '@/shared/schemas/gamification'

const editUsernameSchema = z.object({
  username: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,20}$/, 'Alfanumérico y guion bajo, 3-20 caracteres.')
    .optional()
    .or(z.literal('')),
})
type EditProfileFormValues = z.infer<typeof editUsernameSchema>

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/**
 * Container — `/perfil/editar` (WU10c, design decisions D9/D10). Reads
 * `useExplorerProfile()` (`GET /explorers/me`, the same genuine read
 * `/perfil` uses — TanStack dedupes on the shared key) and renders one of
 * 3 branches: pending -> inline skeleton, `isError` -> blocking retry UI
 * (spec "Edit Form Prefills From Server-Read Profile Data" — failing open
 * into a blank form would silently full-replace `interests` on submit),
 * success -> `EditProfileForm`. `useForm` is never constructed before the
 * read resolves — hook count must stay identical across renders, so the
 * early returns live in this container, not inside the form component.
 *
 * Logout lives here too (D10), not inside `EditProfileForm`: this screen
 * is the app's only logout affordance, so it must render across all 3
 * branches, including when the profile read fails. `LanguageSwitcher`
 * shares that reasoning (WU11) — it is mounted beside logout so it is
 * reachable across all 3 branches too.
 */
export function EditProfilePage() {
  const queryClient = useQueryClient()
  const logout = useAuthStore((state) => state.logout)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const meQuery = useExplorerProfile()

  const handleConfirmLogout = () => {
    setConfirmOpen(false)
    logout()
    queryClient.clear()
  }

  const logoutSection = (
    <>
      <div className="p-4 pt-0">
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <LanguageSwitcher />
          <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
            Cerrar sesión
          </Button>
        </div>
      </div>
      {confirmOpen && (
        <ConfirmationModal
          title="¿Cerrar sesión?"
          description="Vas a necesitar iniciar sesión de nuevo."
          confirmLabel="Cerrar sesión"
          cancelLabel="Cancelar"
          onConfirm={handleConfirmLogout}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  )

  if (meQuery.isPending) {
    return (
      <>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
        {logoutSection}
      </>
    )
  }

  if (meQuery.isError) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="font-sans text-xs text-ink">No pudimos cargar tu perfil.</span>
          <Button variant="primary" onClick={() => meQuery.refetch()}>
            Reintentar
          </Button>
        </div>
        {logoutSection}
      </>
    )
  }

  return (
    <>
      <EditProfileForm me={meQuery.data} />
      {logoutSection}
    </>
  )
}

/**
 * Presentational (well, mostly — still owns local form/mutation state) —
 * the form body of `/perfil/editar`, prefilled from a genuine server read
 * (`me`), never a session-local echo. Username (30-day cooldown), interests
 * (exactly the 6 real `Category` values), and avatar upload/removal (the
 * `avatarChange` union makes replace/remove structurally impossible to
 * combine) all seed their initial state from `me`.
 */
function EditProfileForm({ me }: { me: ExplorerProfileResponse }) {
  const navigate = useNavigate()
  const cooldown = usernameCooldown(me.usernameChangedAt)
  const [selectedInterests, setSelectedInterests] = useState<Category[]>(me.interests)
  const [avatarChange, setAvatarChange] = useState<AvatarChange>({ kind: 'none' })
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const updateProfile = useUpdateProfile()

  const previewUrl = useMemo(
    () => (avatarChange.kind === 'replace' ? URL.createObjectURL(avatarChange.file) : null),
    [avatarChange]
  )
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const displayedAvatarUrl = avatarChange.kind === 'remove' ? null : (previewUrl ?? me.avatarUrl)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editUsernameSchema),
    defaultValues: { username: me.username },
  })

  const toggleInterest = (value: Category) => {
    setSelectedInterests((previous) =>
      previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value]
    )
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('La imagen supera los 5 MB permitidos.')
      event.target.value = ''
      return
    }

    setAvatarError(null)
    // Structurally clears any pending "remove" — a single state variable,
    // not two independent flags (design decision #4).
    setAvatarChange({ kind: 'replace', file })
  }

  const handleRemoveAvatar = () => {
    setAvatarError(null)
    setAvatarChange({ kind: 'remove' })
  }

  const handleUndoAvatarChange = () => {
    setAvatarChange({ kind: 'none' })
  }

  const onSubmit = (values: EditProfileFormValues) => {
    setFormError(null)
    updateProfile.mutate(
      {
        username: values.username ? values.username : undefined,
        interests: selectedInterests,
        avatarChange,
      },
      {
        onSuccess: () => navigate('/perfil'),
        onError: (error) => setFormError(mapProfilePatchError(error).message),
      }
    )
  }

  return (
    <>
      <form className="flex flex-col gap-4 p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-1.5">
          <b className="font-sans text-[11px] font-bold text-ink">Foto de perfil</b>
          <div className="flex items-center gap-3">
            <Avatar
              initial={me.username.charAt(0).toUpperCase()}
              src={displayedAvatarUrl}
              alt="Foto de perfil"
              size="lg"
            />
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] font-bold text-teal">
                Cambiar foto de perfil
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Cambiar foto de perfil"
                  onChange={handleFileChange}
                />
              </label>
              {avatarChange.kind === 'replace' && (
                <button
                  type="button"
                  className="text-left font-sans text-[10px] text-muted"
                  onClick={handleUndoAvatarChange}
                >
                  Cancelar
                </button>
              )}
              {me.avatarUrl && avatarChange.kind !== 'remove' && (
                <button
                  type="button"
                  className="text-left font-sans text-[10px] text-alert"
                  onClick={handleRemoveAvatar}
                >
                  Quitar foto
                </button>
              )}
              {avatarChange.kind === 'remove' && (
                <button
                  type="button"
                  className="text-left font-sans text-[10px] text-muted"
                  onClick={handleUndoAvatarChange}
                >
                  Deshacer
                </button>
              )}
              {avatarError && (
                <span className="font-mono text-[10px] text-alert">{avatarError}</span>
              )}
            </div>
          </div>
        </div>

        <InputField
          label="Nombre de usuario"
          disabled={cooldown.locked}
          hint={
            cooldown.locked
              ? `Podés cambiarlo de nuevo en ${cooldown.daysRemaining} día(s).`
              : errors.username?.message
          }
          {...register('username')}
        />

        <div className="flex flex-col gap-1.5">
          <b className="font-sans text-[11px] font-bold text-ink">Intereses</b>
          <div className="flex flex-wrap gap-2">
            {INTEREST_CATALOG.map((entry) => {
              const selected = selectedInterests.includes(entry.value)
              return (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleInterest(entry.value)}
                >
                  <Pill variant={selected ? 'solid' : 'outline'}>{entry.label}</Pill>
                </button>
              )
            })}
          </div>
        </div>

        {formError && <Toast variant="error" message={formError} />}

        <Button type="submit" variant="primary" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </>
  )
}
