import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { InputField } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Pill } from '@/shared/components/ui/pill'
import { Toast } from '@/shared/components/toast'
import { usernameCooldown } from '@/features/gamification/username-cooldown'
import { INTEREST_CATALOG } from '@/features/gamification/interests-catalog'
import { gamificationKeys, useUpdateProfile } from '@/features/gamification/queries'
import { mapProfilePatchError } from '@/features/gamification/profile-edit-api'
import type { Category, ExplorerProfileResponse } from '@/shared/schemas/gamification'

const editUsernameSchema = z.object({
  username: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,20}$/, 'Alfanumérico y guion bajo, 3-20 caracteres.')
    .optional()
    .or(z.literal('')),
})
type EditProfileFormValues = z.infer<typeof editUsernameSchema>

/**
 * `/perfil/editar` — WU10 (gamification) PR4. Username (with 30-day
 * cooldown, design decision #10) + interests (spec "Interests Restricted to
 * the Real Backend Enum" — exactly the 6 real `Category` values). Avatar
 * upload/removal is added in PR5.
 *
 * No read endpoint for the explorer's current profile exists yet (issue
 * #40): the only source for the current username/interests/
 * `usernameChangedAt` is this session's `['explorer','me-echo']` cache,
 * seeded ONLY by a prior successful `PATCH` this session (design decision
 * #5). An empty cache means the cooldown fails OPEN (field stays enabled;
 * the server is still authority and rejects if actually on cooldown) and
 * interests start unselected.
 */
export function EditProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const echo = queryClient.getQueryData<ExplorerProfileResponse>(gamificationKeys.explorerMeEcho)

  const cooldown = usernameCooldown(echo?.usernameChangedAt ?? null)
  const [selectedInterests, setSelectedInterests] = useState<Category[]>(echo?.interests ?? [])
  const [formError, setFormError] = useState<string | null>(null)
  const updateProfile = useUpdateProfile()

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

  const onSubmit = (values: EditProfileFormValues) => {
    setFormError(null)
    updateProfile.mutate(
      {
        username: values.username ? values.username : undefined,
        interests: selectedInterests,
        avatarChange: { kind: 'none' },
      },
      {
        onSuccess: () => navigate('/perfil'),
        onError: (error) => setFormError(mapProfilePatchError(error).message),
      }
    )
  }

  return (
    <form className="flex flex-col gap-4 p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
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
  )
}
