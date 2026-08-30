import { vi } from 'vitest'

export interface PrefersColorSchemeStub {
  /** Flips the stubbed OS preference and fires a `change` event, simulating
   *  the browser's own behavior when the user (or the OS) toggles dark mode
   *  while the app is open with `mode: 'system'`. */
  emitChange: () => void
}

/**
 * Installs `window.matchMedia` for the exact `(prefers-color-scheme: dark)`
 * query — the only query this app ever issues (`theme.ts`'s
 * `PREFERS_DARK_QUERY`). jsdom 29 implements no `matchMedia` at all (verified:
 * no implementation anywhere in `node_modules/jsdom/lib`), so this stub is
 * what makes `useResolvedTheme`'s `useSyncExternalStore` subscription usable
 * under test at all.
 *
 * Deliberately throws on any other query instead of silently returning
 * `matches: false` — a stray non-theme `matchMedia` call should fail loudly,
 * not degrade into a false negative.
 */
export function stubPrefersColorScheme(matches: boolean): PrefersColorSchemeStub {
  const media = '(prefers-color-scheme: dark)'
  let current = matches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  const mediaQueryList = {
    media,
    get matches() {
      return current
    },
    addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === 'change') listeners.delete(listener)
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  } as unknown as MediaQueryList

  window.matchMedia = vi.fn((query: string) => {
    if (query !== media) {
      throw new Error(`stubPrefersColorScheme: unexpected matchMedia query "${query}"`)
    }
    return mediaQueryList
  })

  return {
    emitChange: () => {
      current = !current
      const event = { matches: current, media } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}
