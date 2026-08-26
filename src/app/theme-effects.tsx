import { useEffect } from 'react'
import { THEME_COLOR_META } from '@/shared/lib/theme'
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme'

/**
 * Null renderer, NOT a hook called in `AppProviders`' body: calling a
 * subscribing hook there would re-render the entire tree — including the
 * permanently-mounted, WebGL-backed `MapPage` (`app-shell.tsx`) — on every
 * theme change. `MapView` subscribes to `useResolvedTheme()` on its own.
 *
 * Sole owner of both theme DOM mutations. `index.html`'s pre-paint bootstrap
 * already set the correct initial values; this only reconciles later changes
 * (explicit switch, or an OS flip while mode === 'system').
 */
export function ThemeEffects() {
  const resolved = useResolvedTheme()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR_META[resolved])
  }, [resolved])

  return null
}
