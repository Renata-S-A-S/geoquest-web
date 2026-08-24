import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PwaUpdatePrompt, UpdatePromptBanner } from './pwa-update-prompt'

/**
 * WU4 (issue #4) — `virtual:pwa-register/react` has no real resolver under
 * Vitest (VitePWA is not loaded in `vitest.config.ts`); the alias in that
 * config points it at `src/test/pwa-register-stub.ts` so this mock can
 * override a resolvable module instead of failing at resolution.
 */
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }))

const mockedUseRegisterSW = vi.mocked(useRegisterSW)

function mockRegisterSW(needRefresh: boolean) {
  const setNeedRefresh = vi.fn()
  const updateServiceWorker = vi.fn().mockResolvedValue(undefined)
  mockedUseRegisterSW.mockReturnValue({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  })
  return { setNeedRefresh, updateServiceWorker }
}

describe('UpdatePromptBanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the Spanish copy and fires onUpdate/onDismiss when its buttons are clicked', () => {
    const onUpdate = vi.fn()
    const onDismiss = vi.fn()
    render(<UpdatePromptBanner onUpdate={onUpdate} onDismiss={onDismiss} />)

    expect(screen.getByText('Nueva versión disponible')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('PwaUpdatePrompt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing when there is no waiting service worker', () => {
    mockRegisterSW(false)

    const { container } = render(<PwaUpdatePrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the banner when a new version is waiting', () => {
    mockRegisterSW(true)

    render(<PwaUpdatePrompt />)

    expect(screen.getByText('Nueva versión disponible')).toBeInTheDocument()
  })

  it('clicking "Actualizar" activates and reloads to the new version', () => {
    const { updateServiceWorker } = mockRegisterSW(true)
    render(<PwaUpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('clicking "Cerrar aviso" sets needRefresh to false without reloading', () => {
    const { setNeedRefresh, updateServiceWorker } = mockRegisterSW(true)
    render(<PwaUpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })

  it('unmounts once the hook reflects needRefresh=false after dismissal', () => {
    const { setNeedRefresh } = mockRegisterSW(true)
    const { rerender, container } = render(<PwaUpdatePrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(setNeedRefresh).toHaveBeenCalledWith(false)

    mockRegisterSW(false)
    rerender(<PwaUpdatePrompt />)

    expect(container).toBeEmptyDOMElement()
  })
})
