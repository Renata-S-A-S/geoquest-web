import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TermsPage } from './terms-page'

function renderPage(initialEntries: string[] = ['/terminos']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/terminos" element={<TermsPage />} />
        <Route path="/configuracion" element={<div>Configuración screen</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TermsPage', () => {
  it('renders the title and the placeholder notice', () => {
    renderPage()

    expect(screen.getByText('Términos y condiciones')).toBeInTheDocument()
    expect(
      screen.getByText(/el equipo legal todavía no redactó el texto definitivo/i)
    ).toBeInTheDocument()
  })

  it('renders all 7 sections, each with a heading and a bracketed placeholder body', () => {
    renderPage()

    expect(screen.getByText('1. Aceptación de los términos')).toBeInTheDocument()
    expect(screen.getByText('7. Contacto')).toBeInTheDocument()
    expect(screen.getAllByText(/^\[Placeholder/)).toHaveLength(7)
  })

  it('navigates back in history on "Volver" instead of a hardcoded /configuracion link', () => {
    renderPage(['/configuracion', '/terminos'])

    fireEvent.click(screen.getByRole('button', { name: /volver/i }))

    expect(screen.getByText('Configuración screen')).toBeInTheDocument()
  })
})
