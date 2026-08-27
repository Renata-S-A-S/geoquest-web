import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubPrefersColorScheme } from '@/test/match-media'
import { THEME_COLOR_META, THEME_STORAGE_KEY, THEME_STORAGE_VERSION } from '@/shared/lib/theme'

/**
 * Permanent drift guard between `index.html`'s inline pre-paint bootstrap
 * (which cannot import a module — see design D-5) and `src/shared/lib/theme.ts`.
 * Reads the real `index.html` from disk, extracts the exact `#theme-bootstrap`
 * script content, and evaluates it against a controlled jsdom environment so
 * any future edit to either side that breaks the contract fails this test.
 */
function extractBootstrapScript(): string {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8')
  const match = /<script id="theme-bootstrap">([\s\S]*?)<\/script>/.exec(html)
  if (!match) {
    throw new Error('theme-bootstrap script not found in index.html')
  }
  return match[1]
}

function runBootstrapScript(): void {
  const script = extractBootstrapScript()
  // Same execution model as an inline <script>: evaluated against the
  // ambient jsdom globals (`document`, `localStorage`, `matchMedia`), not a
  // module scope — an inline head script cannot import theme.ts directly.
  new Function(script)()
}

const UNCHANGED_SENTINEL = '#ABCDEF'

function setMeta(content: string): void {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove())
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', content)
  document.head.appendChild(meta)
}

function getMetaContent(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null
}

describe('index.html theme-bootstrap script (drift guard)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    setMeta(UNCHANGED_SENTINEL)
  })

  it('reads the exact THEME_STORAGE_KEY used by theme-store.ts', () => {
    expect(extractBootstrapScript()).toContain(`'${THEME_STORAGE_KEY}'`)
  })

  it('defaults to light when the key is absent', () => {
    stubPrefersColorScheme(false)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaContent()).toBe(THEME_COLOR_META.light)
  })

  it('applies dark when the persisted mode is "dark"', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'dark' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(false)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })

  it('applies light when the persisted mode is "light", even with an OS dark preference', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'light' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(true)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaContent()).toBe(THEME_COLOR_META.light)
  })

  it('resolves "system" against an OS dark preference', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'system' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(true)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })

  it('never throws on corrupt JSON, and leaves the DOM untouched (the mutation is inside the try block)', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, '{not valid json')
    stubPrefersColorScheme(true)

    expect(() => runBootstrapScript()).not.toThrow()
    // JSON.parse throws before the classList/meta mutation lines run, so the
    // DOM stays exactly as it was pre-script — proven by the sentinel value,
    // which is neither THEME_COLOR_META.light nor .dark.
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaContent()).toBe(UNCHANGED_SENTINEL)
  })

  it('treats an unrecognised mode value as "system" (falls back to the OS preference, not a hardcoded default)', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'sepia' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(true)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })

  it('ignores an unrecognised persisted version and still applies the valid mode', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'dark' }, version: 99 })
    )
    stubPrefersColorScheme(false)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })
})
