import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubPrefersColorScheme } from '@/test/match-media'
import { useThemeStore } from '@/shared/stores/theme-store'
import { ThemeEffects } from './theme-effects'

function getMetaThemeColor(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null
}

describe('ThemeEffects', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useThemeStore.setState({ mode: 'system' })
    document.documentElement.classList.remove('dark')
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove())
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('content', '#F6F3EC')
    document.head.appendChild(meta)
  })

  it('renders nothing (null renderer)', () => {
    stubPrefersColorScheme(false)
    const { container } = render(<ThemeEffects />)
    expect(container).toBeEmptyDOMElement()
  })

  it('adds the "dark" class to <html> and sets the dark meta content when resolved theme is dark', () => {
    stubPrefersColorScheme(false)
    useThemeStore.setState({ mode: 'dark' })

    render(<ThemeEffects />)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaThemeColor()).toBe('#0A1618')
  })

  it('removes the "dark" class and sets the light meta content when resolved theme is light', () => {
    document.documentElement.classList.add('dark')
    stubPrefersColorScheme(false)
    useThemeStore.setState({ mode: 'light' })

    render(<ThemeEffects />)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaThemeColor()).toBe('#F6F3EC')
  })
})
