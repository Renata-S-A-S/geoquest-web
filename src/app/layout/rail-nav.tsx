import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NAV_ITEMS } from './nav-items'
import { Avatar } from '@/shared/components/ui/avatar'
import { cn } from '@/shared/lib/cn'
import { useActiveLocale } from '@/shared/lib/locale'

export interface RailNavProps {
  avatarInitial?: string
  points?: number
}

/**
 * Rail lateral — visible desde 1024px (breakpoint `lg`). El ícono "Perfil" no se
 * repite en la lista: el avatar de abajo ya cumple esa función (ver nota del
 * design system sobre el ajuste vs. la primera versión).
 */
export function RailNav({ avatarInitial = 'G', points = 0 }: RailNavProps) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  const railItems = NAV_ITEMS.filter((item) => item.id !== 'profile')

  return (
    <nav className="hidden h-full w-[74px] flex-col items-center justify-between rounded-md bg-surface-inverse py-4 lg:flex">
      <div className="flex flex-col items-center gap-[22px]">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-teal">
          <b className="font-display text-sm text-on-inverse">G</b>
        </div>
        <div className="flex flex-col items-center gap-[18px]">
          {railItems.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-[3px] font-sans text-[8px]',
                  isActive ? 'font-bold text-teal' : 'text-on-inverse/55'
                )
              }
            >
              <Icon size={18} weight="fill" />
              {t(labelKey)}
            </NavLink>
          ))}
        </div>
      </div>
      <NavLink to="/perfil" className="flex flex-col items-center gap-1">
        <Avatar initial={avatarInitial} size="sm" />
        <span className="font-mono text-[7px] text-on-inverse/60">
          {points.toLocaleString(locale)}
        </span>
      </NavLink>
    </nav>
  )
}
