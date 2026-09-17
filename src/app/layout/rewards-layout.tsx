import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'

/**
 * `/premios` section chrome: one title plus a sub-nav that switches between
 * the reward catalog (index) and the ranking (`/premios/leaderboard`). It
 * lives in `app/layout/` rather than inside a feature because it spans two
 * of them (`features/rewards` and `features/gamification`), exactly like the
 * app-level nav it complements.
 *
 * The catalog link carries `end`: `/premios` is a prefix of
 * `/premios/leaderboard`, so without it the catalog would stay marked as
 * current while the ranking is on screen.
 */
function subnavLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'border-b-2 px-1 pb-1.5 font-sans text-xs transition-colors',
    isActive ? 'border-teal font-bold text-teal' : 'border-transparent text-muted'
  )
}

export function RewardsLayout() {
  const { t } = useTranslation('rewards')

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 px-4 pt-3">
        <b className="font-display text-base text-ink">{t('title')}</b>
        <nav data-testid="rewards-subnav" className="flex gap-4 border-b border-border">
          <NavLink to="/premios" end className={subnavLinkClass}>
            {t('subnav.catalog')}
          </NavLink>
          <NavLink to="/premios/leaderboard" className={subnavLinkClass}>
            {t('subnav.leaderboard')}
          </NavLink>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
