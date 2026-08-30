import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import i18next from 'i18next'
import { X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getCheckinStatus } from '@/features/checkin/checkin-api'
import { getGenericContentRejectionMessage } from '@/features/checkin/checkin-copy'
import { useCheckinStore } from '@/shared/stores/checkin-store'
import { ValidationStatus } from '@/shared/schemas/checkin'

/**
 * Fixed to the `checkin` namespace, dynamic language (PR3a — `checkin-copy.ts`
 * moved from a static `Record` to a `t()`-backed function). Used only for the
 * rejection-message lookup below; every other string in this component reads
 * `t` from `useTranslation()` for reactivity (PR3b).
 */
const tCheckin = i18next.getFixedT(null, 'checkin')

type PendingOutcome = 'pending' | 'approved' | 'rejected'

/** Pure classifier — mirrors the one in `use-checkin.ts` but scoped to this one-shot check. */
function classifyOutcome(validationStatus: ValidationStatus): PendingOutcome {
  if (validationStatus === ValidationStatus.Approved) return 'approved'
  if (validationStatus === ValidationStatus.Rejected) return 'rejected'
  return 'pending'
}

/**
 * WU9 (issue #9), PR4 — one-shot follow-up for a check-in left in
 * `pending-review` (or one whose tab closed mid-poll) when the app reopens.
 *
 * Reads the persisted entry ONCE into local state at mount (a snapshot, not
 * a reactive `useCheckinStore` selector) so calling `clearPending()` after a
 * terminal result never yanks the copy out from under the render that is
 * showing it. Fetches `GET /checkins/{id}` at most once per mount
 * (`staleTime: Infinity`, `retry: false` — design decision #2): this is a
 * single follow-up check, NOT the resumed poll loop from `use-checkin.ts`.
 *
 * Write/clear contract (design decision #4, `tasks.md` Phase 4): a terminal
 * outcome (`approved` / `rejected-content`) or a `404` (the check-in no
 * longer exists) clears the entry. Anything still non-terminal keeps the
 * entry untouched and renders nothing, so a later app open can try again —
 * this deliberately does NOT follow the spec artifact's literal "Still
 * pending on reopen" scenario text (which said to clear even while still
 * pending); that reading would make the entry unrecoverable after the first
 * still-pending check, contradicting the same spec's own "survives app
 * restart" requirement. Implemented per explicit orchestrator instruction
 * for this apply batch — see apply-progress "Deviations from design".
 */
export function PendingCheckinBanner() {
  const { t } = useTranslation()
  const [snapshot] = useState(() => useCheckinStore.getState().pending)
  const [dismissed, setDismissed] = useState(false)
  const clearPending = useCheckinStore((state) => state.clearPending)

  const { data, error } = useQuery({
    queryKey: ['pending-checkin-status', snapshot?.checkInId],
    queryFn: () => getCheckinStatus((snapshot as NonNullable<typeof snapshot>).checkInId),
    enabled: snapshot !== null,
    staleTime: Infinity,
    retry: false,
  })

  const outcome = data ? classifyOutcome(data.validationStatus) : null

  useEffect(() => {
    if (!snapshot) return
    if (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) clearPending()
      return
    }
    if (outcome === 'approved' || outcome === 'rejected') clearPending()
  }, [snapshot, error, outcome, clearPending])

  if (!snapshot || dismissed || !data || outcome === 'pending') return null

  return (
    <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2.5">
      {outcome === 'approved' ? (
        <p className="font-sans text-xs text-ink">
          <b className="text-teal">
            {t('notifications.checkinApproved', { placeName: snapshot.placeName })}
          </b>{' '}
          {t('notifications.xpAndPoints', { xp: data.xpAwarded, geoPoints: data.geoPointsAwarded })}
        </p>
      ) : (
        <p className="font-sans text-xs text-ink">{getGenericContentRejectionMessage(tCheckin)}</p>
      )}
      <button
        type="button"
        aria-label={t('aria.dismiss')}
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted"
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  )
}
