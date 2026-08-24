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
import { Toast } from '@/shared/components/toast'
import { ConfirmationModal } from '@/shared/components/confirmation-modal'
import { useAuthStore } from '@/shared/stores/auth-store'
import { usernameCooldown } from '@/features/gamification/username-cooldown'
import { INTEREST_CATALOG } from '@/features/gamification/interests-catalog'
import { gamificationKeys, useUpdateProfile } from '@/features/gamification/queries'
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
 * `/perfil/editar` — WU10 (gamification) PR4+PR5. Username (with 30-day
 * cooldown, design decision #10), interests (spec "Interests Restricted to
 * the Real Backend Enum" — exactly the 6 real `Category` values), and
 * avatar upload/removal (spec "Avatar Upload and Removal Are Mutually
 * Exclusive" — the `avatarChange` union, design decision #4, makes
 * combining them structurally impossible, not merely validated).
 *
 * No read endpoint for the explorer's current profile exists yet (issue
 * #40): the only source for the current username/interests/avatarUrl/
 * `usernameChangedAt` is this session's `['explorer','me-echo']` cache,
 * seeded ONLY by a prior successful `PATCH` this session (design decision
 * #5). An empty cache means the cooldown fails OPEN (field stays enabled;
 * the server is still authority and rejects if actually on cooldown) and
 * interests/avatar start unselected.
 */
export function EditProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logout = useAuthStore((state) => state.logout)
  const echo = queryClient.getQueryData<ExplorerProfileResponse>(gamificationKeys.explorerMeEcho)

  const cooldown = usernameCooldown(echo?.usernameChangedAt ?? null)
  const [selectedInterests, setSelectedInterests] = useState<Category[]>(echo?.interests ?? [])
  const [avatarChange, setAvatarChange] = useState<AvatarChange>({ kind: 'none' })
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
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

  const displayedAvatarUrl =
    avatarChange.kind === 'remove' ? null : (previewUrl ?? echo?.avatarUrl ?? null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editUsernameSchema),
    defaultValues: { username: echo?.username ?? '' },
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

  const handleConfirmLogout = () => {
    setConfirmOpen(false)
    logout()
    queryClient.clear()
  }

  return (
    <>
      <form className="flex flex-col gap-4 p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-1.5">
          <b className="font-sans text-[11px] font-bold text-ink">Foto de perfil</b>
          <div className="flex items-center gap-3">
            <Avatar
              initial={(echo?.username ?? 'G').charAt(0).toUpperCase()}
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
              {echo?.avatarUrl && avatarChange.kind !== 'remove' && (
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
          <span className="font-sans text-[10px] text-muted">
            Esta selección es de esta sesión — todavía no se guarda hasta que confirmes.
          </span>
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

      <div className="p-4 pt-0">
        <div className="border-t border-border pt-4">
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
}
