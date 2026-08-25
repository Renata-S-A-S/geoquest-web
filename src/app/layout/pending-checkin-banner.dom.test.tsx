import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import i18next from 'i18next'
import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { getGenericContentRejectionMessage } from '@/features/checkin/checkin-copy'
import { PendingCheckinBanner } from './pending-checkin-banner'

/** Same fixed-namespace `t` pattern as the component under test (PR3a). */
const tCheckin = i18next.getFixedT('es', 'checkin')

const baseURL = 'http://localhost:5219'

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
