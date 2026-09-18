import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import i18next from 'i18next'
import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TEST_API_BASE_URL } from '@/test/api-base-url'
import { server } from '@/test/msw-server'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { getGenericContentRejectionMessage } from '@/features/checkin/checkin-copy'
import { PendingCheckinBanner } from './pending-checkin-banner'

/** Same fixed-namespace `t` pattern as the component under test (PR3a). */
const tCheckin = i18next.getFixedT('es', 'checkin')

const baseURL = TEST_API_BASE_URL

function statusPayload(overrides: Record<string, unknown> = {}) {
  return {
    checkInId: 'checkin-1',
    validationStatus: 0,
    awardStatus: 0,
    xpAwarded: 0,
    geoPointsAwarded: 0,
    rejectionReason: null,
    createdAt: '2026-08-24T00:00:00Z',
    ...overrides,
  }
}

function renderBanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PendingCheckinBanner />
    </QueryClientProvider>
  )
}

/**
 * WU9 (issue #9), PR4 — spec "pending-checkin-followup": queries
 * `GET /checkins/{id}` exactly ONCE per mount when a persisted pending entry
 * exists (this is NOT the resumed poll loop from `use-checkin.ts`), shows the
 * result, then clears the entry. Deviation from the spec's literal "Still
 * pending on reopen" scenario prose (which says the entry is cleared even
 * while still pending): `tasks.md`'s Phase 4 description and design decision
 * #4 ("keep on pending-review") both call for KEEPING the entry so a later
 * app open can still resolve it — implemented that way per explicit
 * orchestrator instruction for this apply batch; see apply-progress
 * "Deviations from design" for the full note.
 */
describe('PendingCheckinBanner', () => {
  beforeEach(() => {
    useCheckinStore.getState().clearPending()
  })

  it('renders nothing when there is no persisted pending check-in', () => {
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches once, shows the approved result with xp/points and place name, and clears the store', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    let requestCount = 0
    server.use(
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        requestCount += 1
        return HttpResponse.json(
          statusPayload({ validationStatus: 2, xpAwarded: 50, geoPointsAwarded: 10 })
        )
      })
    )

    renderBanner()

    await waitFor(() => expect(screen.getByText(/50 XP/)).toBeInTheDocument())
    expect(screen.getByText(/El Cielo/)).toBeInTheDocument()
    expect(screen.getByText(/10 GeoPoints/)).toBeInTheDocument()
    expect(requestCount).toBe(1)
    expect(useCheckinStore.getState().pending).toBeNull()
  })

  it('shows the generic content-rejection message on validationStatus 3 and clears the store', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    server.use(
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(
          statusPayload({ validationStatus: 3, rejectionReason: 'nudity-should-never-leak' })
        )
      )
    )

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText(getGenericContentRejectionMessage(tCheckin))).toBeInTheDocument()
    )
    expect(screen.queryByText(/nudity-should-never-leak/)).not.toBeInTheDocument()
    expect(useCheckinStore.getState().pending).toBeNull()
  })

  it('renders nothing and keeps the entry while still PendingManualReview (no polling repeated)', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    let requestCount = 0
    server.use(
      http.get(`${baseURL}/checkins/checkin-1`, () => {
        requestCount += 1
        return HttpResponse.json(statusPayload({ validationStatus: 1 }))
      })
    )

    const { container } = renderBanner()

    await waitFor(() => expect(requestCount).toBe(1))
    expect(container).toBeEmptyDOMElement()
    expect(useCheckinStore.getState().pending).not.toBeNull()

    // Give any accidental re-fetch a chance to happen, then confirm it didn't.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(requestCount).toBe(1)
  })

  it('clears the entry on a 404 without rendering a result', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'missing', placeName: 'El Cielo' })
    server.use(
      http.get(`${baseURL}/checkins/missing`, () => new HttpResponse(null, { status: 404 }))
    )

    const { container } = renderBanner()

    await waitFor(() => expect(useCheckinStore.getState().pending).toBeNull())
    expect(container).toBeEmptyDOMElement()
  })

  it('dismissing the banner hides it even though the outcome was already resolved', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    server.use(
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(
          statusPayload({ validationStatus: 2, xpAwarded: 50, geoPointsAwarded: 10 })
        )
      )
    )

    renderBanner()
    await waitFor(() => expect(screen.getByText(/50 XP/)).toBeInTheDocument())

    screen.getByRole('button', { name: /cerrar/i }).click()

    await waitFor(() => expect(screen.queryByText(/50 XP/)).not.toBeInTheDocument())
  })

  it('renders the approved outcome and the shared dismiss aria-label in English after switching language', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    server.use(
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(
          statusPayload({ validationStatus: 2, xpAwarded: 50, geoPointsAwarded: 10 })
        )
      )
    )

    await act(async () => {
      await i18next.changeLanguage('en')
    })

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText(/Check-in approved at El Cielo/)).toBeInTheDocument()
    )
    expect(screen.getByText(/50 XP/)).toBeInTheDocument()
    expect(screen.getByText(/10 GeoPoints/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss notice' })).toBeInTheDocument()
  })
})

/**
 * Issue #108 — the banner is the SECOND path an approved check-in can reach
 * the UI (the first is `use-checkin.ts`'s poll loop), so it runs the same
 * badge diff and the same cleanup. The "before" snapshot is read from the
 * persisted store at mount, which is exactly why it is persisted: the tab
 * that took it may be long gone.
 */
describe('PendingCheckinBanner badge diff (issue #108)', () => {
  const CHECKIN_CREATED_AT = '2026-09-17T12:00:00Z'

  function profilePayload(badges: { name: string; awardedAtUtc: string }[]) {
    return {
      explorerId: 'explorer-1',
      totalXP: 500,
      weeklyXP: 50,
      geoPointsBalance: 120,
      currentLevel: 'Explorador',
      currentStreak: 5,
      longestStreak: 9,
      lastActivityLocalDate: '2026-09-17',
      badges,
    }
  }

  function approvedStatusRoute() {
    return http.get(`${baseURL}/checkins/checkin-1`, () =>
      HttpResponse.json(
        statusPayload({
          validationStatus: 2,
          xpAwarded: 50,
          geoPointsAwarded: 10,
          createdAt: CHECKIN_CREATED_AT,
        })
      )
    )
  }

  beforeEach(() => {
    useCheckinStore.getState().clearPending()
    useCheckinStore.getState().clearBadgeNamesBefore()
  })

  it('names the badge unlocked by the approved check-in and clears the snapshot', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    useCheckinStore.getState().setBadgeNamesBefore(['Primer paso'])
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () =>
        HttpResponse.json(
          profilePayload([
            { name: 'Primer paso', awardedAtUtc: '2026-01-01T00:00:00Z' },
            { name: 'Explorador', awardedAtUtc: '2026-09-17T12:00:03Z' },
          ])
        )
      )
    )

    renderBanner()

    await waitFor(() =>
      expect(screen.getByText('¡Desbloqueaste un badge nuevo: Explorador!')).toBeInTheDocument()
    )
    expect(screen.getByText(/50 XP/)).toBeInTheDocument()
    await waitFor(() => expect(useCheckinStore.getState().badgeNamesBefore).toBeNull())
  })

  it('never asks for the profile while the check-in is still pending review', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    useCheckinStore.getState().setBadgeNamesBefore(['Primer paso'])
    let profileRequestCount = 0
    server.use(
      http.get(`${baseURL}/checkins/checkin-1`, () =>
        HttpResponse.json(statusPayload({ validationStatus: 1 }))
      ),
      http.get(`${baseURL}/gaming/profile`, () => {
        profileRequestCount += 1
        return HttpResponse.json(profilePayload([]))
      })
    )

    renderBanner()

    await waitFor(() => expect(useCheckinStore.getState().pending).not.toBeNull())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(profileRequestCount).toBe(0)
  })

  it('claims nothing when the badge was already owned before the check-in', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    useCheckinStore.getState().setBadgeNamesBefore(['Primer paso'])
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () =>
        HttpResponse.json(
          profilePayload([{ name: 'Primer paso', awardedAtUtc: '2026-01-01T00:00:00Z' }])
        )
      )
    )

    renderBanner()

    await waitFor(() => expect(screen.getByText(/50 XP/)).toBeInTheDocument())
    expect(screen.queryByText(/Desbloqueaste/)).not.toBeInTheDocument()
  })

  it('shows the plain approved notice with no badge line and no error when the snapshot is missing', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () =>
        HttpResponse.json(
          profilePayload([{ name: 'Explorador', awardedAtUtc: '2026-09-17T12:00:03Z' }])
        )
      )
    )

    renderBanner()

    await waitFor(() => expect(screen.getByText(/50 XP/)).toBeInTheDocument())
    expect(screen.queryByText(/Desbloqueaste/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No pudimos/)).not.toBeInTheDocument()
  })

  it('shows the plain approved notice with no error when the profile refetch fails', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'checkin-1', placeName: 'El Cielo' })
    useCheckinStore.getState().setBadgeNamesBefore(['Primer paso'])
    server.use(
      approvedStatusRoute(),
      http.get(`${baseURL}/gaming/profile`, () => new HttpResponse(null, { status: 500 }))
    )

    renderBanner()

    await waitFor(() => expect(screen.getByText(/50 XP/)).toBeInTheDocument())
    expect(screen.queryByText(/Desbloqueaste/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No pudimos/)).not.toBeInTheDocument()
    await waitFor(() => expect(useCheckinStore.getState().badgeNamesBefore).toBeNull())
  })

  it('clears the snapshot alongside the pending entry on a 404', async () => {
    useCheckinStore.getState().setPending({ checkInId: 'missing', placeName: 'El Cielo' })
    useCheckinStore.getState().setBadgeNamesBefore(['Primer paso'])
    server.use(
      http.get(`${baseURL}/checkins/missing`, () => new HttpResponse(null, { status: 404 }))
    )

    renderBanner()

    await waitFor(() => expect(useCheckinStore.getState().pending).toBeNull())
    expect(useCheckinStore.getState().badgeNamesBefore).toBeNull()
  })
})
