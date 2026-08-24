import { act } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18next, { createInstance } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { resources, ns, defaultNS } from '@/shared/locales/resources'
import { LanguageSwitcher } from './language-switcher'

/**
 * The shared jsdom test singleton (`src/test/i18n.ts`) deliberately has no
 * `LanguageDetector` (design D-C — determinism). The persistence contract
 * (design decision, spec "Selection persists across reload") is a real
 * `i18next-browser-languagedetector` behavior, not something the component
 * writes manually, so proving it needs a real detector-backed instance —
 * scoped to this one test via `I18nextProvider`, never touching the shared
 * singleton every other test relies on.
 */
function createDetectorBackedInstance() {
  const instance = createInstance()
  void instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      ns,
      defaultNS,
      fallbackLng: 'es',
      supportedLngs: ['es', 'en'],
      detection: {
        order: ['localStorage'],
        caches: ['localStorage'],
        lookupLocalStorage: 'i18nextLng',
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    })
  return instance
}

describe('LanguageSwitcher', () => {
  it('renders both endonyms unchanged under the default Spanish language', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
  })

  it('renders the exact same endonyms under English — never translated', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(<LanguageSwitcher />)

    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()

    await i18next.changeLanguage('es')
  })

  it('marks the active language button aria-pressed and the other one not', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the active language and re-renders aria-pressed on click', async () => {
    render(<LanguageSwitcher />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'English' }))
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'false')

    await i18next.changeLanguage('es')
  })

  it('persists the selection to localStorage via the detector cache, not a manual write', async () => {
    const scopedInstance = createDetectorBackedInstance()
    render(
      <I18nextProvider i18n={scopedInstance}>
        <LanguageSwitcher />
      </I18nextProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'English' }))

    await waitFor(() => expect(window.localStorage.getItem('i18nextLng')).toBe('en'))
  })
})
