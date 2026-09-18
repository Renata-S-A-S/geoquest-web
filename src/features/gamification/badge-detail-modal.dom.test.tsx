import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BadgeDetailModal } from './badge-detail-modal'
import type { BadgeAward } from '@/shared/schemas/gamification'

const DESCRIPTION = 'Completaste tu primer check-in verificado.'

const badge: BadgeAward = {
  name: 'Primer paso',
  description: DESCRIPTION,
  iconUrl: null,
  awardedAtUtc: '2026-08-20T00:00:00Z',
}

/**
 * WU10 (gamification), design decision #7 — local `selectedBadge` state in
 * the profile container, `TornPanel edge="top" backing="ink"` overlay.
 * Spec "Badge Detail Modal": name + description + awarded date. The
 * description comes straight from the server (backend issue #41 closed
 * 2026-08-24); `iconUrl` is parsed but never rendered because it is NULL
 * for every seeded badge row.
 */
describe('BadgeDetailModal', () => {
  it('renders as a dialog with the badge name and awarded date', () => {
    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Primer paso')).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('renders the description the backend sends, verbatim', () => {
    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
  })

  it('places the description between the name and the awarded date', () => {
    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    const text = screen.getByRole('dialog').textContent ?? ''
    const nameAt = text.indexOf('Primer paso')
    const descriptionAt = text.indexOf(DESCRIPTION)
    const dateAt = text.search(/\d{4}/)

    expect(nameAt).toBeGreaterThanOrEqual(0)
    expect(descriptionAt).toBeGreaterThan(nameAt)
    expect(dateAt).toBeGreaterThan(descriptionAt)
  })

  it('renders the server description under the en locale too (it is DB free text, not a translatable key)', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('es')
    })
  })

  it('renders no icon (iconUrl is NULL for every seeded badge, so there is nothing to show)', () => {
    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<BadgeDetailModal badge={badge} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('badge-modal-backdrop'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when the panel content itself is clicked', () => {
    const onClose = vi.fn()
    render(<BadgeDetailModal badge={badge} onClose={onClose} />)

    fireEvent.click(screen.getByRole('dialog'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<BadgeDetailModal badge={badge} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('gamification EN-switch: awarded date renders using the active (en-US) locale, not hardcoded es-CO', async () => {
    await act(async () => {
      await i18next.changeLanguage('en')
    })

    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    // 2026-08-20 -> "20 de agosto de 2026" under es-CO vs "August 19/20, 2026"
    // under en-US (exact day depends on the runner's local timezone offset
    // from the UTC source timestamp — not what this test proves).
    expect(screen.getByText(/^August \d{1,2}, 2026$/)).toBeInTheDocument()
    expect(screen.queryByText(/de agosto de/)).not.toBeInTheDocument()

    await act(async () => {
      await i18next.changeLanguage('es')
    })
  })
})
