import { AxiosError, type AxiosResponse } from 'axios'
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { mapLoginError } from './auth-api'

const t = i18next.getFixedT('es', 'auth')
const tEn = i18next.getFixedT('en', 'auth')

/**
 * Only the static/fallback branches of `mapLoginError` are in scope for the
 * i18n migration (WU11 PR2) — the `detail` passthrough branch stays a raw
 * server string by design and is asserted here to prove it is untouched.
 */
function makeAxiosError(status: number, data?: unknown): AxiosError {
  const response: AxiosResponse = {
    data,
    status,
    statusText: '',
    headers: {},
    config: { headers: {} } as never,
  }
  return new AxiosError('Request failed', undefined, undefined, undefined, response)
}

function makeNoResponseAxiosError(): AxiosError {
  return new AxiosError('Network Error')
}

describe('mapLoginError', () => {
  it('returns the translated network-error message when the request has no response', () => {
    expect(mapLoginError(makeNoResponseAxiosError(), t)).toBe(
      'No pudimos conectar con el servidor. Intentá de nuevo.'
    )
  })

  it('returns the translated invalid-credentials message for a 401 / Identity.InvalidCredentials', () => {
    const error = makeAxiosError(401, { title: 'Identity.InvalidCredentials' })
    expect(mapLoginError(error, t)).toBe('Credenciales inválidas')
  })

  it('returns the real server detail for a 403 account-locked response when detail is present', () => {
    const error = makeAxiosError(403, {
      title: 'Identity.AccountLockedOut',
      detail: 'Bloqueada por 10 intentos fallidos.',
    })
    expect(mapLoginError(error, t)).toBe('Bloqueada por 10 intentos fallidos.')
  })

  it('falls back to the translated static account-locked message when detail is absent', () => {
    const error = makeAxiosError(403, { title: 'Identity.AccountLockedOut' })
    expect(mapLoginError(error, t)).toBe('Tu cuenta está bloqueada temporalmente.')
  })

  it('falls back to the translated static validation message when detail is absent on a 400', () => {
    const error = makeAxiosError(400, { title: 'Validation.Failed' })
    expect(mapLoginError(error, t)).toBe('Revisá los datos ingresados.')
  })

  it('returns the translated generic message for a non-axios error', () => {
    expect(mapLoginError(new Error('boom'), t)).toBe(
      'No pudimos iniciar sesión. Intentá de nuevo en unos minutos.'
    )
  })

  it('uses the real English dictionary when built with an English t()', () => {
    const error = makeAxiosError(401, { title: 'Identity.InvalidCredentials' })
    expect(mapLoginError(error, tEn)).toBe('Invalid credentials')
  })
})
