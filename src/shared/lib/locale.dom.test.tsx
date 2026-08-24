import { act } from 'react'
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { useActiveLocale } from './locale'

/**
 * Probe component defined inline on purpose — its only job is to prove
 * `useActiveLocale()` re-renders the SAME mounted instance on a language
 * change (design D-D), unlike a bare `getActiveLocale()` read.
 */
function LocaleAwareNumber({ value }: { value: number }) {
  const locale = useActiveLocale()
  return <span data-testid="formatted">{value.toLocaleString(locale)}</span>
}

describe('useActiveLocale — D-D regression', () => {
  it('re-renders the same component instance with the new locale format, with no remount', async () => {
    render(<LocaleAwareNumber value={1234} />)

    expect(screen.getByTestId('formatted')).toHaveTextContent('1.234')

    await act(async () => {
      await i18next.changeLanguage('en')
    })

    expect(screen.getByTestId('formatted')).toHaveTextContent('1,234')
  })
})
