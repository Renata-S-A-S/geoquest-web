import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BadgeDetailModal } from './badge-detail-modal'

const badge = { name: 'Primer paso', awardedAtUtc: '2026-08-20T00:00:00Z' }

/**
 * WU10 (gamification), design decision #7 — local `selectedBadge` state in
 * the profile container, `TornPanel edge="top" backing="ink"` overlay.
 * Spec "Badge Detail Modal": name + awarded date ONLY — no description or
 * `iconUrl` (backend doesn't provide them yet, issue #41).
 */
describe('BadgeDetailModal', () => {
  it('renders as a dialog with the badge name and awarded date, nothing else', () => {
    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Primer paso')).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('never renders a description or iconUrl placeholder (backend does not provide them yet, issue #41)', () => {
    render(<BadgeDetailModal badge={badge} onClose={vi.fn()} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/descripci[oó]n/i)).not.toBeInTheDocument()
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
