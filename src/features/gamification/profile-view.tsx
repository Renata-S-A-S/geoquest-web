import { Fire, Gear, SlidersHorizontal } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { Progress } from '@/shared/components/ui/progress'
import { Stamp } from '@/shared/components/stamp'
import { levelProgress } from '@/features/gamification/levels'
import { useActiveLocale } from '@/shared/lib/locale'
import type { AssembledProfile } from '@/features/gamification/profile-identity'
import type { BadgeAward } from '@/shared/schemas/gamification'

export interface ProfileViewProps {
  profile: AssembledProfile
  /** True when the identity source (`GET /explorers/me`) failed — shows a retry affordance instead of fabricating a username (spec "One source fails"). */
  identityError?: boolean
  onRetryIdentity?: () => void
  onBadgeClick?: (badge: BadgeAward) => void
}

/**
 * Presentational — `/perfil` (WU10, design decision #7's container wires
 * `onBadgeClick` from PR3 onward). The level TEXT always comes from
 * `profile.currentLevel` (server enum name), translated at render time via
 * the `gamification.json` `levels.<enum>` map (WU11 i18n spec "Server
 * Enum Translation"); `levelProgress` only supplies the bar geometry
 * (design's reconciliation rule).
 */
export function ProfileView({
  profile,
  identityError,
  onRetryIdentity,
  onBadgeClick,
}: ProfileViewProps) {
  const { t } = useTranslation('gamification')
  const progress = levelProgress(profile.totalXP)
  const initial = profile.username ? profile.username.charAt(0).toUpperCase() : 'G'
  // Subscribed read (design D-D) — re-renders totalXP's formatting on
  // language change, unlike the pure `getActiveLocale()`.
  const totalXpLocale = useActiveLocale()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Avatar
          initial={initial}
          src={profile.avatarUrl}
          alt={profile.username ?? undefined}
          size="lg"
        />
        <div className="flex flex-1 flex-col">
          {identityError ? (
            <div className="flex items-center gap-2">
              <span className="font-sans text-xs text-alert">{t('profile.identityError')}</span>
              <Button variant="secondary" onClick={onRetryIdentity}>
                {t('profile.retry')}
              </Button>
            </div>
          ) : (
            <b className="font-display text-base text-ink">
              {profile.username ?? t('profile.defaultUsername')}
            </b>
          )}
          <div className="flex items-center gap-1 font-sans text-[11px] text-muted">
            <Fire size={14} weight="fill" className="text-coral" />
            <span>{t('profile.streak', { count: profile.currentStreak })}</span>
          </div>
        </div>
        {/* D5 (design, PO-confirmed): additive sibling icon link to
            Configuración — the existing gear->edit link above is an
            asserted spec behavior and stays untouched. */}
        <Link to="/configuracion" aria-label={t('profile.settingsAria')} className="text-muted">
          <SlidersHorizontal size={20} weight="fill" />
        </Link>
        <Link to="/perfil/editar" aria-label={t('profile.editAria')} className="text-muted">
          <Gear size={20} weight="fill" />
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between font-sans text-[11px] font-bold text-ink">
          <span>{t(`levels.${profile.currentLevel}`)}</span>
          {!progress.isMax && <span>{t(`levels.${progress.nextLevel}`)}</span>}
        </div>
        <Progress
          value={progress.fraction * 100}
          valueText={progress.isMax ? t('profile.maxLevel') : undefined}
        />
        <span className="font-mono text-[10px] text-muted">
          {progress.isMax
            ? t('profile.maxLevelXp', { xp: profile.totalXP.toLocaleString(totalXpLocale) })
            : t('profile.xpProgress', {
                current: progress.xpIntoLevel,
                total: progress.xpForNextLevel,
              })}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-center">
          <b className="block font-display text-sm text-ink">{profile.weeklyXP}</b>
          <span className="font-sans text-[10px] text-muted">{t('profile.weeklyXp')}</span>
        </div>
        <div className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-center">
          <b className="block font-display text-sm text-ink">{profile.geoPointsBalance}</b>
          <span className="font-sans text-[10px] text-muted">GeoPoints</span>
        </div>
        <div className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-center">
          <b className="block font-display text-sm text-ink">{profile.longestStreak}</b>
          <span className="font-sans text-[10px] text-muted">{t('profile.longestStreak')}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {profile.badges.map((badge) =>
          onBadgeClick ? (
            <button
              key={badge.name + badge.awardedAtUtc}
              type="button"
              aria-label={badge.name}
              onClick={() => onBadgeClick(badge)}
            >
              <Stamp size={52}>{badge.name}</Stamp>
            </button>
          ) : (
            <Stamp key={badge.name + badge.awardedAtUtc} size={52}>
              {badge.name}
            </Stamp>
          )
        )}
      </div>
    </div>
  )
}
