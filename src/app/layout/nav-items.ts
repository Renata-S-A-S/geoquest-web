import { MapTrifold, Path, Gift, User } from '@phosphor-icons/react'

/**
 * 4 secciones de navegación — ver sección "Navegación" del design system.
 *
 * `id` is the stable, non-translated key used for structural logic (e.g.
 * `RailNav`'s profile exclusion); `labelKey` is the i18next key resolved via
 * `t()`. Never key structural behavior off `labelKey`/the rendered label —
 * that breaks under a non-Spanish active language (spec: "Structural
 * Navigation Filtering Independent of Labels").
 */
export const NAV_ITEMS = [
  { id: 'map', to: '/', labelKey: 'nav.map', icon: MapTrifold },
  { id: 'routes', to: '/rutas', labelKey: 'nav.routes', icon: Path },
  { id: 'rewards', to: '/premios/leaderboard', labelKey: 'nav.rewards', icon: Gift },
  { id: 'profile', to: '/perfil', labelKey: 'nav.profile', icon: User },
] as const

export type NavItemId = (typeof NAV_ITEMS)[number]['id']
