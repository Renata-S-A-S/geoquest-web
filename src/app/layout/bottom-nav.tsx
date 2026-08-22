import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './nav-items'
import { cn } from '@/shared/lib/cn'

/**
 * Barra inferior — visible por debajo de 1024px (breakpoint `lg` de Tailwind).
 * Reemplazada por RailNav en pantallas >=1024px.
 */
export function BottomNav() {
  return (
    <nav className="flex justify-around border-t border-border bg-white px-1 pb-1.5 pt-2 lg:hidden">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 font-sans text-[10px]',
              isActive ? 'font-bold text-teal' : 'text-muted'
            )
          }
        >
          <Icon size={18} weight="fill" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
