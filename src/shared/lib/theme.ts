export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'] as const

/** MUST match `theme-store.ts`'s `persist` `name`/`version` byte-for-byte —
 *  `index.html`'s pre-paint bootstrap reads this exact key, and
 *  `src/test/theme-bootstrap.dom.test.ts` asserts the two agree. */
export const THEME_STORAGE_KEY = 'geoquest.theme'
export const THEME_STORAGE_VERSION = 1

export const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)'

/** `<meta name="theme-color">` values = the `paper` token (app-shell background,
 *  `app-shell.tsx:31`), which is what the browser chrome abuts. The PWA MANIFEST
 *  theme_color stays #10262B always — founder decision #1, `vite.config.ts` untouched. */
export const THEME_COLOR_META: Record<ResolvedTheme, string> = {
  light: '#F6F3EC',
  dark: '#0A1618',
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}
