import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import i18next from 'i18next'
import { X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getCheckinStatus } from '@/features/checkin/checkin-api'
import { getGenericContentRejectionMessage } from '@/features/checkin/checkin-copy'
import { diffUnlockedBadges } from '@/features/checkin/badge-diff'
import { getGamingProfile } from '@/features/gamification/gamification-api'
import { gamificationKeys } from '@/features/gamification/queries'
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
  /**
   * Issue #108: the badge wording is shared with the check-in success
   * screen, so it lives in the `checkin` namespace rather than being
   * duplicated into `common`. Read through `useTranslation` (not the
   * module-level `tCheckin` above) so it follows a language switch.
   */
  const { t: tCheckinNs } = useTranslation('checkin')
  const [snapshot] = useState(() => useCheckinStore.getState().pending)
  /**
   * Issue #108: read at mount for the same reason as `snapshot` above — the
   * effect below clears it as soon as the outcome is terminal, which can
   * happen before the profile refetch that needs it has landed.
   */
  const [badgeNamesBefore] = useState(() => useCheckinStore.getState().badgeNamesBefore)
  const [dismissed, setDismissed] = useState(false)
  const clearPending = useCheckinStore((state) => state.clearPending)
  const clearBadgeNamesBefore = useCheckinStore((state) => state.clearBadgeNamesBefore)

  const { data, error } = useQuery({
    queryKey: ['pending-checkin-status', snapshot?.checkInId],
    queryFn: () => getCheckinStatus((snapshot as NonNullable<typeof snapshot>).checkInId),
    enabled: snapshot !== null,
    staleTime: Infinity,
    retry: false,
  })

  const outcome = data ? classifyOutcome(data.validationStatus) : null

  /**
   * Issue #108 — the "after" half of the badge diff, requested ONLY once the
   * check-in is known to be approved: a still-pending or rejected follow-up
   * has nothing to celebrate and must not spend a request. Errors are left
   * unread on purpose (`retry: false`, no `error` destructured): a failed
   * profile read degrades to the plain approved notice, never to an error.
   */
  const { data: profile } = useQuery({
    queryKey: gamificationKeys.profile,
    queryFn: getGamingProfile,
    enabled: outcome === 'approved',
    staleTime: 0,
    retry: false,
  })

  // `data.createdAt` is the server's clock, the same one behind
  // `awardedAtUtc` — never this device's, which may be skewed.
  const unlockedBadgeNames =
    data && profile ? diffUnlockedBadges(badgeNamesBefore, profile.badges, data.createdAt) : []

  useEffect(() => {
    if (!snapshot) return
    if (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        clearPending()
        clearBadgeNamesBefore()
      }
      return
    }
    if (outcome === 'approved' || outcome === 'rejected') {
      clearPending()
      clearBadgeNamesBefore()
    }
  }, [snapshot, error, outcome, clearPending, clearBadgeNamesBefore])

  if (!snapshot || dismissed || !data || outcome === 'pending') return null

  return (
    <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2.5">
      {outcome === 'approved' ? (
        <p className="font-sans text-xs text-ink">
          <b className="text-teal">
            {t('notifications.checkinApproved', { placeName: snapshot.placeName })}
          </b>{' '}
          {t('notifications.xpAndPoints', { xp: data.xpAwarded, geoPoints: data.geoPointsAwarded })}
          {unlockedBadgeNames.length > 0 && (
            <b className="mt-0.5 block text-coral">
              {tCheckinNs('approved.badgeUnlocked', {
                count: unlockedBadgeNames.length,
                badgeNames: unlockedBadgeNames.join(', '),
              })}
            </b>
          )}
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
