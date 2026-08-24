import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileView } from './profile-view'
import type { AssembledProfile } from './profile-identity'

const baseProfile: AssembledProfile = {
  username: 'nachomed',
  avatarUrl: null,
  totalXP: 820,
  weeklyXP: 120,
  geoPointsBalance: 40,
  currentLevel: 'Traveler',
  currentStreak: 3,
  longestStreak: 8,
  lastActivityLocalDate: '2026-08-24',
  badges: [{ name: 'Primer paso', awardedAtUtc: '2026-08-20T00:00:00Z' }],
}

describe('ProfileView', () => {
  it('renders the XP progress bar with the correct aria-valuenow and "X / Y XP" caption', () => {
    render(<ProfileView profile={baseProfile} />)

    // 820 total, Traveler starts at 500, next Adventurer at 1500 -> 320/1000 = 32%
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '32')
    expect(screen.getByText('320 / 1000 XP')).toBeInTheDocument()
  })

  it('renders the server-sent currentLevel as the level label text', () => {
    render(<ProfileView profile={baseProfile} />)

    expect(screen.getByText('Traveler')).toBeInTheDocument()
  })

  it('renders the current streak', () => {
    render(<ProfileView profile={baseProfile} />)

    expect(screen.getByText('3 días de racha')).toBeInTheDocument()
  })

  it('renders one badge stamp per badge, showing the badge name', () => {
    render(<ProfileView profile={baseProfile} />)

    expect(screen.getByText('Primer paso')).toBeInTheDocument()
  })

  it('falls back the avatar to the first letter of the username when avatarUrl is null', () => {
    render(<ProfileView profile={baseProfile} />)

    expect(screen.getByText('N')).toBeInTheDocument()
  })

  it('renders a full bar with no X / Y denominator and "Nivel máximo" caption at max level (Legend)', () => {
    const maxProfile: AssembledProfile = {
      ...baseProfile,
      totalXP: 8240,
      currentLevel: 'Legend',
    }
    render(<ProfileView profile={maxProfile} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(bar).toHaveAttribute('aria-valuetext', 'Nivel máximo')
    expect(screen.getByText(/Nivel máximo/)).toBeInTheDocument()
    expect(screen.queryByText(/\d+ \/ \d+ XP/)).not.toBeInTheDocument()
  })

  it('shows an identity retry affordance instead of a fabricated username when identityError is true', () => {
    const onRetryIdentity = vi.fn()
    render(<ProfileView profile={baseProfile} identityError onRetryIdentity={onRetryIdentity} />)

    expect(screen.queryByText('nachomed')).not.toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: /reintentar/i })
    fireEvent.click(retryButton)
    expect(onRetryIdentity).toHaveBeenCalledTimes(1)
  })

  it('calls onBadgeClick with the badge when a badge stamp is clicked', () => {
    const onBadgeClick = vi.fn()
    render(<ProfileView profile={baseProfile} onBadgeClick={onBadgeClick} />)

    fireEvent.click(screen.getByRole('button', { name: /Primer paso/i }))

    expect(onBadgeClick).toHaveBeenCalledWith(baseProfile.badges[0])
  })

  it('renders badges as non-interactive when onBadgeClick is not provided', () => {
    render(<ProfileView profile={baseProfile} />)

    expect(screen.queryByRole('button', { name: /Primer paso/i })).not.toBeInTheDocument()
    expect(screen.getByText('Primer paso')).toBeInTheDocument()
  })
})
