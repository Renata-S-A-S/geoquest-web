import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CameraSlash, WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/shared/components/ui/button'
import { Spinner } from '@/shared/components/ui/spinner'
import { Stamp } from '@/shared/components/stamp'
import { SEED_PLACE_NAME } from '@/features/checkin/checkin-config'
import {
  getCheckinRuleRejectionMessage,
  getGenericContentRejectionMessage,
} from '@/features/checkin/checkin-copy'
import { useCheckin } from '@/features/checkin/use-checkin'

/**
 * Pantalla de check-in — WU9 (issue #9), PR3. Puramente presentacional:
 * cámara real, GPS real, submit y polling viven en `useCheckin`. Reemplaza
 * por completo el mock anterior (setTimeout + alternancia aprobado/rechazado
 * + ambos TODOs).
 *
 * Rechazo por regla de negocio (`rejected-rule`, ej. fuera de radio) muestra
 * un mensaje específico y accionable; rechazo por IA/contenido
 * (`rejected-content`) muestra siempre el mismo mensaje genérico — nunca se
 * expone `rejectionReason` (spec "Typed Rejection Messaging").
 *
 * All copy reads from the `checkin` i18n namespace (WU11) — `SEED_PLACE_NAME`,
 * `XP`, and `GeoPoints` stay untranslated (data/brand terms, not UI copy).
 */
export function CheckinPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('checkin')
  const { state, videoRef, capture, retry } = useCheckin()

  switch (state.kind) {
    case 'requesting-permissions':
      return (
        <CenteredState>
          <Spinner size={34} className="mb-2.5" />
          <b className="font-sans text-xs text-ink">{t('permissions.requesting')}</b>
        </CenteredState>
      )

    case 'permission-denied':
      return (
        <CenteredState>
          <CameraSlash size={30} weight="fill" className="mb-2 text-alert" />
          <b className="px-5 text-center font-sans text-xs text-ink">
            {state.device === 'camera'
              ? t('permissions.cameraDenied')
              : t('permissions.locationDenied')}
          </b>
          <span className="mb-3 mt-1 px-6 text-center font-sans text-[10px] text-muted">
            {t('permissions.deniedHint')}
          </span>
          <Button variant="primary" onClick={retry}>
            {t('actions.retry')}
          </Button>
        </CenteredState>
      )

    case 'sending':
      return (
        <CenteredState>
          <Spinner size={34} className="mb-2.5" />
          <b className="font-sans text-xs text-ink">{t('sending.validating')}</b>
          <span className="font-sans text-[10px] text-muted">{t('sending.validatingHint')}</span>
        </CenteredState>
      )

    case 'pending':
      return (
        <CenteredState>
          <Spinner size={34} className="mb-2.5" />
          <b className="font-sans text-xs text-ink">{t('pending.reviewing')}</b>
          <span className="font-sans text-[10px] text-muted">{t('pending.reviewingHint')}</span>
        </CenteredState>
      )

    case 'pending-review':
      return (
        <CenteredState>
          <b className="px-5 text-center font-sans text-xs text-ink">{t('pendingReview.title')}</b>
          <span className="mb-3 mt-1 px-6 text-center font-sans text-[10px] text-muted">
            {t('pendingReview.hint')}
          </span>
          <Button variant="secondary" onClick={() => navigate('/perfil')}>
            {t('actions.viewProfile')}
          </Button>
        </CenteredState>
      )

    case 'approved':
      return (
        <CenteredState>
          <Stamp size={52} color="coral" className="mb-2.5">
            {SEED_PLACE_NAME}
          </Stamp>
          <b className="font-display text-base text-teal">+{state.xpAwarded} XP</b>
          <span className="mb-3 mt-0.5 font-sans text-[10.5px] text-muted">
            +{state.geoPointsAwarded} GeoPoints · {SEED_PLACE_NAME}
          </span>
          <Button variant="secondary" onClick={() => navigate('/perfil')}>
            {t('actions.viewProfile')}
          </Button>
        </CenteredState>
      )

    case 'rejected-content':
      return (
        <CenteredState>
          <WarningCircle size={30} weight="fill" className="mb-2 text-alert" />
          <b className="px-5 text-center font-sans text-xs text-ink">
            {getGenericContentRejectionMessage(t)}
          </b>
          <Button variant="primary" className="mt-3" onClick={retry}>
            {t('actions.tryAgain')}
          </Button>
        </CenteredState>
      )

    case 'rejected-rule':
      return (
        <CenteredState>
          <WarningCircle size={30} weight="fill" className="mb-2 text-alert" />
          <b className="px-5 text-center font-sans text-xs text-ink">
            {getCheckinRuleRejectionMessage(t, state.rule)}
          </b>
          <Button variant="primary" className="mt-3" onClick={retry}>
            {t('actions.tryAgain')}
          </Button>
        </CenteredState>
      )

    case 'error':
      return (
        <CenteredState>
          <WarningCircle size={30} weight="fill" className="mb-2 text-alert" />
          <b className="px-5 text-center font-sans text-xs text-ink">{state.message}</b>
          <Button variant="primary" className="mt-3" onClick={retry}>
            {t('actions.tryAgain')}
          </Button>
        </CenteredState>
      )

    case 'camera':
    default:
      return (
        <div className="flex h-dvh flex-col bg-ink">
          <div className="relative flex-1">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex justify-center pb-10 pt-4">
            <button
              type="button"
              aria-label={t('camera.captureLabel')}
              onClick={capture}
              className="h-16 w-16 rounded-full border-[3px] border-coral bg-white"
            />
          </div>
        </div>
      )
  }
}

/** Contenedor centrado en columna para todos los estados no-cámara — fondo cream, full-bleed. */
function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      {children}
    </div>
  )
}
