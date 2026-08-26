import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'

/**
 * Map redesign (search-first layout) — the search input extracted from
 * `place-list-panel.tsx` so `map-page.tsx` can own it as a page-level,
 * always-visible header element instead of a list-panel concern. Purely
 * presentational/controlled: the query, debounce and dropdown-open state
 * all live in `map-page.tsx`.
 */

export interface PlaceSearchBarProps {
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  className?: string
}

export function PlaceSearchBar({ value, onChange, onFocus, className }: PlaceSearchBarProps) {
  const { t } = useTranslation('map')

  return (
    <div className={cn('relative', className)}>
      <MagnifyingGlass
        size={16}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        type="text"
        role="textbox"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="h-9 w-full rounded-xs border border-border bg-white pl-8 pr-8 font-sans text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/40"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label={t('search.clear')}
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        >
          <X size={14} weight="bold" />
        </button>
      )}
    </div>
  )
}
