import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsPage } from './settings-page'

/**
 * explorer-onboarding-settings PR6 — scaffold scope only (design D6/D7,
 * tasks 6.3/6.4). This slice mounts `LanguageSwitcher` on `/configuracion`;
 * prefs toggles, T&C link, and logout land in PR7 (see tasks Phase 7) and
 * are deliberately absent here.
 *
 * `ThemeSwitcher` is design decision D7's other half ("both preference
 * controls move ... into settings-page.tsx"), but per explicit orchestrator
 * instruction for this batch: `ThemeSwitcher` and `theme-store.ts` exist
 * only on the separate, unmerged `feat/frontend-theme-system-f-switcher-ui`
 * branch — not on `main` or this branch. Grepping this branch's `src/`
 * confirms zero `ThemeSwitcher`/`theme-store` matches outside doc-comment
 * mentions. Fabricating a substitute component was explicitly disallowed,
 * so this suite intentionally does NOT assert a `ThemeSwitcher` render —
 * that assertion is deferred to whichever PR lands after the theme-system
 * branch merges. See apply-progress "Blocking Risk" for the full note.
 */
describe('SettingsPage (PR6 scaffold)', () => {
  it('renders the Configuración title', () => {
    render(<SettingsPage />)

    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('mounts LanguageSwitcher — both endonym buttons are reachable', () => {
    render(<SettingsPage />)

    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
  })
})
