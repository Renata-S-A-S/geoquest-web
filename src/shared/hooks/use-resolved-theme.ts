import { useSyncExternalStore } from 'react'
import { PREFERS_DARK_QUERY, resolveTheme, type ResolvedTheme } from '@/shared/lib/theme'
import { useThemeStore } from '@/shared/stores/theme-store'

// VERIFIED: jsdom 29 does NOT implement window.matchMedia (no implementation
// anywhere in node_modules/jsdom/lib). Every guard below is load-bearing —
// without it, `app-shell.dom.test.tsx` / `map-page.dom.test.tsx` crash the
// moment MapView or ThemeEffects enters the tree.
function subscribePrefersDark(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(PREFERS_DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getPrefersDarkSnapshot(): boolean {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(PREFERS_DARK_QUERY).matches
}

export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribePrefersDark, getPrefersDarkSnapshot, () => false)
}

export function useResolvedTheme(): ResolvedTheme {
  const mode = useThemeStore((state) => state.mode)
  return resolveTheme(mode, usePrefersDark())
}
