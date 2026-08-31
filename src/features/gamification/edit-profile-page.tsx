import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { Avatar } from '@/shared/components/ui/avatar'
import { InputField } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Pill } from '@/shared/components/ui/pill'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Toast } from '@/shared/components/toast'
import { usernameCooldown } from '@/features/gamification/username-cooldown'
import { INTEREST_CATALOG } from '@/features/gamification/interests-catalog'
import { useExplorerProfile, useUpdateProfile } from '@/features/gamification/queries'
import { mapProfilePatchError } from '@/features/gamification/profile-edit-api'
import type { AvatarChange, Category, ExplorerProfileResponse } from '@/shared/schemas/gamification'

/**
 * Factory function, not a static schema (WU11 PR4c i18n migration, mirrors
 * `createLoginSchema`): zod bakes its message strings in at construction
 * time, so a schema built once at module load would freeze its validation
 * copy in whatever language was active on first import. `EditProfileForm`
 * rebuilds it from the current `t` on every render instead.
 */
function createEditUsernameSchema(t: TFunction) {
  return z.object({
    username: z
      .string()
      .regex(/^[A-Za-z0-9_]{3,20}$/, t('editProfile.usernameFormatError'))
      .optional()
      .or(z.literal('')),
  })
}
type EditProfileFormValues = z.infer<ReturnType<typeof createEditUsernameSchema>>

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/**
 * Container — `/perfil/editar` (WU10c, design decisions D9/D10; PR8 of
 * explorer-onboarding-settings removed logout/theme/language — see below).
 * Reads `useExplorerProfile()` (`GET /explorers/me`, the same genuine read
 * `/perfil` uses — TanStack dedupes on the shared key) and renders one of
 * 3 branches: pending -> inline skeleton, `isError` -> blocking retry UI
 * (spec "Edit Form Prefills From Server-Read Profile Data" — failing open
 * into a blank form would silently full-replace `interests` on submit),
 * success -> `EditProfileForm`. `useForm` is never constructed before the
 * read resolves — hook count must stay identical across renders, so the
 * early returns live in this container, not inside the form component.
 *
 * Logout, `ThemeSwitcher`, and `LanguageSwitcher` moved to `/configuracion`
 * (`settings-page.tsx`) in PR8 (design D7, spec "Single Logout Surface" /
 * "Theme Switcher Relocation") — Configuración is now the app's sole
 * preferences/logout surface. This isolated removal is separately
 * revertible from the additive PR1-PR7 route commits.
 */
export function EditProfilePage() {
  const { t } = useTranslation('gamification')
  const meQuery = useExplorerProfile()

  if (meQuery.isPending) {
    return (
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
    )
  }

  if (meQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <span className="font-sans text-xs text-ink">{t('profile.loadError')}</span>
        <Button variant="primary" onClick={() => meQuery.refetch()}>
          {t('profile.retry')}
        </Button>
      </div>
    )
  }

  return <EditProfileForm me={meQuery.data} />
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
  const { t } = useTranslation('gamification')
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
    resolver: zodResolver(createEditUsernameSchema(t)),
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
      setAvatarError(t('editProfile.avatarTooLarge'))
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
        onError: (error) => setFormError(mapProfilePatchError(error, t).message),
      }
    )
  }

  return (
    <>
      <form className="flex flex-col gap-4 p-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-1.5">
          <b className="font-sans text-[11px] font-bold text-ink">{t('editProfile.photoLabel')}</b>
          <div className="flex items-center gap-3">
            <Avatar
              initial={me.username.charAt(0).toUpperCase()}
              src={displayedAvatarUrl}
              alt={t('editProfile.photoLabel')}
              size="lg"
            />
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[11px] font-bold text-teal">
                {t('editProfile.changePhoto')}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={t('editProfile.changePhoto')}
                  onChange={handleFileChange}
                />
              </label>
              {avatarChange.kind === 'replace' && (
                <button
                  type="button"
                  className="text-left font-sans text-[10px] text-muted"
                  onClick={handleUndoAvatarChange}
                >
                  {t('editProfile.undoPhotoChange')}
                </button>
              )}
              {me.avatarUrl && avatarChange.kind !== 'remove' && (
                <button
                  type="button"
                  className="text-left font-sans text-[10px] text-alert"
                  onClick={handleRemoveAvatar}
                >
                  {t('editProfile.removePhoto')}
                </button>
              )}
              {avatarChange.kind === 'remove' && (
                <button
                  type="button"
                  className="text-left font-sans text-[10px] text-muted"
                  onClick={handleUndoAvatarChange}
                >
                  {t('editProfile.undoRemove')}
                </button>
              )}
              {avatarError && (
                <span className="font-mono text-[10px] text-alert">{avatarError}</span>
              )}
            </div>
          </div>
        </div>

        <InputField
          label={t('editProfile.usernameLabel')}
          disabled={cooldown.locked}
          hint={
            cooldown.locked
              ? t('editProfile.usernameCooldownHint', { days: cooldown.daysRemaining })
              : errors.username?.message
          }
          {...register('username')}
        />

        <div className="flex flex-col gap-1.5">
          <b className="font-sans text-[11px] font-bold text-ink">
            {t('editProfile.interestsLabel')}
          </b>
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
                  <Pill variant={selected ? 'solid' : 'outline'}>
                    {t(entry.labelKey, { ns: 'gamification' })}
                  </Pill>
                </button>
              )
            })}
          </div>
        </div>

        {formError && <Toast variant="error" message={formError} />}

        <Button type="submit" variant="primary" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? t('editProfile.saving') : t('editProfile.save')}
        </Button>
      </form>
    </>
  )
}
