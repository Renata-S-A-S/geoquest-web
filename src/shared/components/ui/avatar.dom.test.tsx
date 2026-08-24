import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './avatar'

/**
 * WU10 (gamification), design decision #6 — extends `Avatar` with OPTIONAL
 * `src`/`alt` instead of a new sibling component, so `rail-nav.tsx` (the
 * only existing consumer) keeps its zero-line diff.
 */
describe('Avatar', () => {
  it('renders only the initial when no src is given (existing rail-nav behavior)', () => {
    render(<Avatar initial="G" />)

    expect(screen.getByText('G')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders an <img> with the given src/alt when src is provided', () => {
    render(
      <Avatar initial="G" src="https://cdn.example.com/avatars/a.jpg" alt="Foto de nachomed" />
    )

    const img = screen.getByRole('img', { name: 'Foto de nachomed' })
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/avatars/a.jpg')
    expect(screen.queryByText('G')).not.toBeInTheDocument()
  })

  it('falls back to the initial when the image fails to load (onError)', () => {
    render(<Avatar initial="G" src="https://cdn.example.com/avatars/broken.jpg" alt="Foto" />)

    const img = screen.getByRole('img', { name: 'Foto' })
    fireEvent.error(img)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument()
  })

  it('treats a null src the same as no src (initials only)', () => {
    render(<Avatar initial="G" src={null} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument()
  })
})
