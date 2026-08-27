import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { useThemeStore } from '@/shared/stores/theme-store'
import { ThemeSwitcher } from './theme-switcher'

/**
 * Mirrors `language-switcher.dom.test.tsx`'s structure. Persistence is
 * `useThemeStore`'s own `zustand/persist` (design D-4), not a manual
 * `localStorage.setItem` in the component, so there is nothing to prove
 * beyond "the store method was called with the right mode" — the store's
 * own persistence contract is covered by `theme-store.dom.test.ts` (Phase D1).
 */
describe('ThemeSwitcher', () => {
  afterEach(() => {
    useThemeStore.setState({ mode: 'system' })
  })

  it('renders all three translated options under the default Spanish language', () => {
    render(<ThemeSwitcher />)

    expect(screen.getByRole('button', { name: 'Claro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oscuro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sistema' })).toBeInTheDocument()
  })

  it('renders the real English labels after switching language', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(<ThemeSwitcher />)

    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument()

    await i18next.changeLanguage('es')
  })

  it('marks the active mode aria-pressed and the other two not, reflecting the store', () => {
    useThemeStore.setState({ mode: 'dark' })

    render(<ThemeSwitcher />)

    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Sistema' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('exposes the group as an accessible group labelled by the theme label', () => {
    render(<ThemeSwitcher />)

    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument()
  })

  it('calls useThemeStore.setMode with the clicked mode and re-renders aria-pressed', () => {
    render(<ThemeSwitcher />)

    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }))

    expect(useThemeStore.getState().mode).toBe('dark')
    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'false')
  })
})
