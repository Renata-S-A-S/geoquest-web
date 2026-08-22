import { MapTrifold, Path, Gift, User } from '@phosphor-icons/react'

/** 4 secciones de navegación — ver sección "Navegación" del design system. */
export const NAV_ITEMS = [
  { to: '/', label: 'Mapa', icon: MapTrifold },
  { to: '/rutas', label: 'Rutas', icon: Path },
  { to: '/premios', label: 'Premios', icon: Gift },
  { to: '/perfil', label: 'Perfil', icon: User },
] as const
