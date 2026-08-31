import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from '@phosphor-icons/react'

const SECTION_KEYS = [
  'acceptance',
  'usage',
  'account',
  'privacy',
  'rewards',
  'liability',
  'contact',
] as const

/**
 * `/terminos` — structural placeholder for Términos y Condiciones. Public
 * route (sibling of `/login`, no session required) since a legal page
 * should stay reachable independent of auth state, even though the only
 * current entry point is the link on `/configuracion`. The back action uses
 * `navigate(-1)` (browser history) rather than a hardcoded link to
 * `/configuracion`, since that route is auth-gated and an unauthenticated
 * visitor landing here directly (bookmark, shared link) must not be bounced
 * into a login redirect on "Volver". Section copy is a visibly marked
 * placeholder pending Legal's final text — see
 * `shared/locales/{es,en}/terms.json`.
 */
export function TermsPage() {
  const { t } = useTranslation('terms')
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-1 font-sans text-[11px] font-bold text-teal"
      >
        <ArrowLeft size={14} weight="bold" />
        {t('back')}
      </button>

      <div className="flex flex-col gap-1">
        <b className="font-display text-lg text-ink">{t('title')}</b>
        <span className="font-mono text-[10px] text-muted">{t('lastUpdated')}</span>
      </div>

      <div className="rounded-md border border-border bg-surface-alert px-3 py-2 font-sans text-[11px] text-alert">
        {t('placeholderNotice')}
      </div>

      <div className="flex flex-col gap-4">
        {SECTION_KEYS.map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <b className="font-sans text-[12px] font-bold text-ink">
              {t(`sections.${key}.heading`)}
            </b>
            <p className="font-sans text-[11px] leading-relaxed text-muted">
              {t(`sections.${key}.body`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
