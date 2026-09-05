import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarBlank, Star, WarningCircle, X } from '@phosphor-icons/react'
import { TornPanel } from '@/shared/components/torn-panel'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from '@/shared/components/empty-state'
import { Pill } from '@/shared/components/ui/pill'
import { Spinner } from '@/shared/components/ui/spinner'
import { Toast } from '@/shared/components/toast'
import { useRouteDetail, useStartRoute } from '@/features/routes/queries'
import { getStartRouteErrorMessage, mapStartRouteError } from '@/features/routes/routes-api'
import { RouteStopDetailCard } from '@/features/routes/route-stop-detail-card'
import type { RouteStopResult } from '@/features/routes/schemas'

export interface RouteDetailModalProps {
  routeId: string
  onClose: () => void
}

/**
 * Rutas detail drill-down — same established modal pattern as
 * `ConfirmationModal` / `BadgeDetailModal`: full-bleed bottom sheet on
 * mobile, centered `TornPanel` card from `lg`, closes on Escape or a
 * backdrop click.
 *
 * The list only hands us a `routeId` — `GET /routes` returns stopless
 * summaries (`RouteSummaryResult`), so this modal fetches its own detail
 * via `useRouteDetail(routeId)` and owns its own loading/error states,
 * mirroring `RouteStopDetailCard`'s exact `usePlaceDetail` idiom below.
 *
 * The real `RouteStopResult` is only `{ placeId, name }` — no category, so
 * this modal does NOT render a per-stop category pill (decision 1235).
 * That's not lost: `RouteStopDetailCard` already renders the real category
 * from `GET /places/{id}` once a stop is tapped. Fetching category per stop
 * here would be an N+1 request for a decorative label, rejected by design.
 *
 * "Iniciar ruta" is a REAL network call (`POST /routes/{id}/start`, via
 * `useStartRoute`) — not mocked. On success it shows an inline confirmation
 * (`routeProgressId`) for this session only; there is still no persistent
 * "route in progress" tracker across reloads. That is now a gap in THIS
 * component, not in the backend: `GET /routes/{id}/progress` exists and is
 * already wired as `useRouteProgress` (slice 2). Reconciling the started
 * route against it on mount is deliberately left to a later work unit.
 *
 * Tapping a stop swaps the panel body for `RouteStopDetailCard` — the SAME
 * rich place-detail experience as the map's `SelectedPlaceCard` (real
 * `GET /places/{id}` fetch, photo/name/badge/description/action) — instead
 * of stacking a second overlay, since there's no map underneath to layer
 * over here. Escape/backdrop-click close the stop detail first (back to the
 * stop list) and only close the whole modal on a second trigger, mirroring
 * how a nested drill-down back button behaves elsewhere in the app.
 */
export function RouteDetailModal({ routeId, onClose }: RouteDetailModalProps) {
  const { t } = useTranslation('routes')
  const { data: route, isPending, isError } = useRouteDetail(routeId)
  const startRoute = useStartRoute()
  const [selectedStop, setSelectedStop] = useState<RouteStopResult | null>(null)

  function handleClose() {
    if (selectedStop) {
      setSelectedStop(null)
    } else {
      onClose()
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selectedStop) {
        setSelectedStop(null)
      } else {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedStop, onClose])

  const startError = startRoute.isError ? mapStartRouteError(startRoute.error) : null

  return (
    <div
      data-testid="route-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim lg:items-center"
      onClick={handleClose}
    >
      <div className="w-full lg:w-[460px]" onClick={(event) => event.stopPropagation()}>
        <TornPanel
          edge="top"
          backing="ink"
          role="dialog"
          aria-modal="true"
          aria-label={selectedStop?.name ?? route?.name ?? t('title')}
          data-testid="route-detail-modal"
          className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto px-6 pb-8 pt-8 lg:px-9 lg:pb-8 lg:pt-10"
        >
          {isPending ? (
            <div
              data-testid="route-detail-loading"
              className="flex items-center justify-center py-10"
            >
              <Spinner size={24} />
            </div>
          ) : isError || !route ? (
            <div data-testid="route-detail-error" className="flex flex-col gap-3">
              <EmptyState
                icon={WarningCircle}
                title={t('detail.errorTitle')}
                description={t('detail.errorDescription')}
              />
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-sm border border-border py-2.5 font-sans text-xs font-bold text-ink"
              >
                {t('detail.close')}
              </button>
            </div>
          ) : selectedStop ? (
            <RouteStopDetailCard
              placeId={selectedStop.placeId}
              onDismiss={() => setSelectedStop(null)}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <b className="font-display text-lg text-ink lg:text-[21px]">{route.name}</b>
                  <span className="font-sans text-[12px] text-muted">{route.theme}</span>
                </div>
                <button
                  type="button"
                  aria-label={t('detail.close')}
                  onClick={onClose}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-teal text-teal"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Pill variant="outline">
                  <CalendarBlank size={12} weight="bold" />
                  {t('detail.windowDays', { count: route.windowDays })}
                </Pill>
                <Pill variant="solid">
                  <Star size={12} weight="fill" />
                  {t('detail.reward', { points: route.completionPointsReward })}
                </Pill>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-sans text-xs font-bold text-ink">
                  {t('detail.stopsTitle')}
                </span>
                <ol className="flex flex-col gap-2">
                  {route.stops.map((stop, index) => (
                    <li
                      key={stop.placeId}
                      data-testid="route-detail-stop"
                      className="rounded-md border border-border bg-surface-raised"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedStop(stop)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-teal font-mono text-[10px] font-bold text-teal">
                          {index + 1}
                        </span>
                        <span className="font-sans text-xs font-bold text-ink">
                          {stop.name ?? '—'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              {startRoute.isSuccess ? (
                <div className="flex flex-col items-center gap-2 pt-1 text-center">
                  <Toast variant="success" message={t('start.successTitle')} />
                  <span className="font-sans text-[11px] text-muted">
                    {t('start.successDescription', { days: route.windowDays })}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  {startError && (
                    <Toast variant="error" message={getStartRouteErrorMessage(startError.kind)} />
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    disabled={startRoute.isPending}
                    onClick={() => startRoute.mutate(routeId)}
                    className="w-full"
                  >
                    {startRoute.isPending ? (
                      <>
                        <Spinner size={16} />
                        {t('start.starting')}
                      </>
                    ) : (
                      t('start.action')
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </TornPanel>
      </div>
    </div>
  )
}
