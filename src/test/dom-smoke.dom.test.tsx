import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

/**
 * Trivial component defined inline on purpose: this file's only job is to
 * prove the jsdom Vitest project renders React components and reacts to
 * real DOM events — it has no relationship to any feature under `src/features`.
 */
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
}

describe('jsdom test environment bootstrap', () => {
  it('renders a component and updates the DOM after a real click event', () => {
    render(<Counter />)

    expect(screen.getByRole('button', { name: 'Count: 0' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button', { name: 'Count: 1' })).toBeInTheDocument()
  })
})
