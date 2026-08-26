import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubPrefersColorScheme } from '@/test/match-media'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useResolvedTheme } from './use-resolved-theme'

describe('useResolvedTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useThemeStore.setState({ mode: 'system' })
  })

  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('mode=%s, prefersDark=%s -> %s', (mode, prefersDark, expected) => {
    stubPrefersColorScheme(prefersDark)
    useThemeStore.setState({ mode })

    const { result } = renderHook(() => useResolvedTheme())

    expect(result.current).toBe(expected)
  })

  it('re-resolves to "dark" when the OS preference flips while mode stays "system"', () => {
    const stub = stubPrefersColorScheme(false)
    useThemeStore.setState({ mode: 'system' })

    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('light')

    act(() => {
      stub.emitChange()
    })

    expect(result.current).toBe('dark')
  })

  it('falls back to "light" when matchMedia is unavailable, without throwing', () => {
    const original = window.matchMedia
    // @ts-expect-error -- simulate an environment with no matchMedia at all,
    // matching real jsdom 29 before this suite's stub is installed.
    delete window.matchMedia
    useThemeStore.setState({ mode: 'system' })

    const { result } = renderHook(() => useResolvedTheme())

    expect(result.current).toBe('light')

    window.matchMedia = original
  })
})
