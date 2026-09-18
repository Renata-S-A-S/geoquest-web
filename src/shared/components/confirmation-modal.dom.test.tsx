import { render, screen } from '@testing-library/react'
import { SignOut, Trash } from '@phosphor-icons/react'
import { describe, expect, it } from 'vitest'
import { ConfirmationModal } from './confirmation-modal'

/**
 * The icon slot is the only thing under test here: `ConfirmationModal`
 * hardcoded `SignOut`, and account deletion needs `Trash` without disturbing
 * the logout call sites. The expected markup is derived from the real Phosphor
 * component in each assertion instead of a hardcoded path, so these tests stay
 * valid across icon-pack updates.
 */
function renderModal(props: Partial<Parameters<typeof ConfirmationModal>[0]> = {}) {
  return render(
    <ConfirmationModal
      title="Título"
      description="Descripción"
      confirmLabel="Confirmar"
      onConfirm={() => {}}
      onCancel={() => {}}
      {...props}
    />
  )
}

/** The inner markup of a Phosphor icon rendered standalone at the modal's size/weight. */
function expectedIconMarkup(Icon: typeof SignOut): string {
  const { container } = render(<Icon size={20} weight="fill" />)
  const markup = container.querySelector('svg')?.innerHTML
  container.remove()
  return markup ?? ''
}

describe('ConfirmationModal icon slot', () => {
  it('defaults to SignOut so existing logout call sites keep their current icon', () => {
    const expected = expectedIconMarkup(SignOut)
    const { container } = renderModal()

    expect(container.querySelector('svg')?.innerHTML).toBe(expected)
  })

  it('renders the icon it was given instead of SignOut', () => {
    const expected = expectedIconMarkup(Trash)
    const { container } = renderModal({ icon: Trash })

    expect(container.querySelector('svg')?.innerHTML).toBe(expected)
  })

  it('still hides the icon circle entirely when destructive is false', () => {
    const { container } = renderModal({ destructive: false, icon: Trash })

    expect(container.querySelector('svg')).toBeNull()
  })

  it('keeps rendering the title, description and both actions regardless of the icon', () => {
    renderModal({ icon: Trash })

    expect(screen.getByText('Título')).toBeInTheDocument()
    expect(screen.getByText('Descripción')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })
})
