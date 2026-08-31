import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useOnboardingStore } from '@/shared/stores/onboarding-store'
import { SplashPage } from './splash-page'

function renderSplash() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<SplashPage />} />
        <Route path="/registro" element={<div>registro-route</div>} />
        <Route path="/login" element={<div>login-route</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SplashPage', () => {
  it('renders the real Spanish copy with both CTAs', () => {
    renderSplash()

    expect(screen.getByText('GeoQuest')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ya tengo cuenta' })).toBeInTheDocument()
  })

  it('"Crear cuenta" navigates to /registro without touching the onboarding flag', () => {
    renderSplash()

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(screen.getByText('registro-route')).toBeInTheDocument()
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false)
  })

  it('"Ya tengo cuenta" sets the onboarding flag then navigates to /login (D2)', () => {
    renderSplash()

    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo cuenta' }))

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true)
    expect(screen.getByText('login-route')).toBeInTheDocument()
  })
})
