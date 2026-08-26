import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlaceSearchBar } from './place-search-bar'

describe('PlaceSearchBar', () => {
  it('calls onChange with the typed value', () => {
    const onChange = vi.fn()
    render(<PlaceSearchBar value="" onChange={onChange} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'arvi' } })

    expect(onChange).toHaveBeenCalledWith('arvi')
  })

  it('shows a clear button only when there is a value, and clears on click', () => {
    const onChange = vi.fn()
    const { rerender } = render(<PlaceSearchBar value="" onChange={onChange} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    rerender(<PlaceSearchBar value="arvi" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('calls onFocus when the input is focused', () => {
    const onFocus = vi.fn()
    render(<PlaceSearchBar value="arvi" onChange={vi.fn()} onFocus={onFocus} />)

    fireEvent.focus(screen.getByRole('textbox'))

    expect(onFocus).toHaveBeenCalledTimes(1)
  })
})
