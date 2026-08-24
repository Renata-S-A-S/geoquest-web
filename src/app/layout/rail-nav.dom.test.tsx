import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18next from 'i18next'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { RailNav } from './rail-nav'

const renderRail = (points?: number) =>
  render(
    <MemoryRouter>
      <RailNav points={points} />
    </MemoryRouter>
  )

describe('RailNav', () => {
  it('excludes the profile entry under the default Spanish language (structural id filter)', () => {
    renderRail()

    expect(screen.queryByText('Perfil')).not.toBeInTheDocument()
    expect(screen.getByText('Mapa')).toBeInTheDocument()
  })

  it('formats points with a period thousands separator under the default Spanish locale', () => {
    renderRail(1234)

    expect(screen.getByText('1.234')).toBeInTheDocument()
  })

  it('excludes the profile entry under English too, proving the filter is not label-driven', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    renderRail()

    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
    expect(screen.getByText('Map')).toBeInTheDocument()
    expect(screen.getByText('Routes')).toBeInTheDocument()
    expect(screen.getByText('Rewards')).toBeInTheDocument()
  })

  it('formats points with a comma thousands separator after switching to English, proving useActiveLocale is wired', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    renderRail(1234)

    expect(screen.getByText('1,234')).toBeInTheDocument()
  })
})
