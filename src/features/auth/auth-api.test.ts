import { AxiosError, type AxiosResponse } from 'axios'
import { HttpResponse, http } from 'msw'
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import {
  forgotPasswordRequest,
  mapForgotPasswordError,
  mapLoginError,
  mapRegisterError,
  mapResetPasswordError,
  registerRequest,
  resetPasswordRequest,
} from './auth-api'
import type { RegisterRequest } from '@/shared/schemas/auth'

const t = i18next.getFixedT('es', 'auth')
const tEn = i18next.getFixedT('en', 'auth')
const baseURL = 'http://localhost:5219'

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

describe('registerRequest', () => {
  it('POSTs /auth/register with the full payload including latitude/longitude and parses the AuthResponse', async () => {
    let receivedBody: unknown
    server.use(
      http.post(`${baseURL}/auth/register`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          accessToken: 'access-token',
          accessTokenExpiresAtUtc: '2026-08-30T00:00:00Z',
          refreshToken: 'refresh-token',
          refreshTokenExpiresAtUtc: '2026-09-06T00:00:00Z',
        })
      })
    )

    const payload: RegisterRequest = {
      username: 'nachomed',
      email: 'nachomed@example.com',
      password: 'password123',
      latitude: 6.2442,
      longitude: -75.5812,
    }
    const result = await registerRequest(payload)

    expect(receivedBody).toEqual(payload)
    expect(result).toEqual({
      accessToken: 'access-token',
      accessTokenExpiresAtUtc: '2026-08-30T00:00:00Z',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAtUtc: '2026-09-06T00:00:00Z',
    })
  })

  it('POSTs /auth/register without latitude/longitude when they are omitted from the payload', async () => {
    let receivedBody: unknown
    server.use(
      http.post(`${baseURL}/auth/register`, async ({ request }) => {
        receivedBody = await request.json()
        return HttpResponse.json({
          accessToken: 'access-token',
          accessTokenExpiresAtUtc: '2026-08-30T00:00:00Z',
          refreshToken: 'refresh-token',
          refreshTokenExpiresAtUtc: '2026-09-06T00:00:00Z',
        })
      })
    )

    const payload: RegisterRequest = {
      username: 'nachomed',
      email: 'nachomed@example.com',
      password: 'password123',
    }
    await registerRequest(payload)

    expect(receivedBody).toEqual({
      username: 'nachomed',
      email: 'nachomed@example.com',
      password: 'password123',
    })
    expect(receivedBody).not.toHaveProperty('latitude')
    expect(receivedBody).not.toHaveProperty('longitude')
  })
})

describe('mapRegisterError', () => {
  it('returns the translated duplicate-explorer message for Identity.DuplicateExplorer, never the raw server detail', () => {
    const error = makeAxiosError(409, {
      title: 'Identity.DuplicateExplorer',
      detail: 'Ya existe un explorador con ese correo electrónico.',
    })
    expect(mapRegisterError(error, t)).toBe(
      'Ya existe una cuenta con ese correo o nombre de usuario.'
    )
  })

  it('passes through the real server detail for a 400 / Validation.Failed response', () => {
    const error = makeAxiosError(400, {
      title: 'Validation.Failed',
      detail: 'El nombre de usuario es inválido.',
    })
    expect(mapRegisterError(error, t)).toBe('El nombre de usuario es inválido.')
  })

  it('falls back to the translated static validation message when detail is absent on a 400', () => {
    const error = makeAxiosError(400, { title: 'Validation.Failed' })
    expect(mapRegisterError(error, t)).toBe('Revisá los datos ingresados.')
  })

  it('returns the translated rate-limited message for a 429 response', () => {
    const error = makeAxiosError(429, {})
    expect(mapRegisterError(error, t)).toBe('Demasiados intentos. Probá de nuevo más tarde.')
  })

  it('returns the translated network-error message when the request has no response', () => {
    expect(mapRegisterError(makeNoResponseAxiosError(), t)).toBe(
      'No pudimos conectar con el servidor. Intentá de nuevo.'
    )
  })

  it('uses the real English dictionary when built with an English t()', () => {
    const error = makeAxiosError(409, { title: 'Identity.DuplicateExplorer' })
    expect(mapRegisterError(error, tEn)).toBe(
      'An account with that email or username already exists.'
    )
  })
})

describe('forgotPasswordRequest', () => {
  it('POSTs /auth/password/forgot with the email payload and resolves with no meaningful body', async () => {
    let receivedBody: unknown
    server.use(
      http.post(`${baseURL}/auth/password/forgot`, async ({ request }) => {
        receivedBody = await request.json()
        return new HttpResponse(null, { status: 200 })
      })
    )

    await expect(forgotPasswordRequest({ email: 'user@example.com' })).resolves.toBeUndefined()
    expect(receivedBody).toEqual({ email: 'user@example.com' })
  })
})

describe('mapForgotPasswordError', () => {
  it('returns the translated network-error message when the request has no response', () => {
    expect(mapForgotPasswordError(makeNoResponseAxiosError(), t)).toBe(
      'No pudimos conectar con el servidor. Intentá de nuevo.'
    )
  })

  it('returns the translated rate-limited message for a 429 response', () => {
    const error = makeAxiosError(429, {})
    expect(mapForgotPasswordError(error, t)).toBe('Demasiados intentos. Probá de nuevo más tarde.')
  })

  it('passes through the real server detail for a 400 / Validation.Failed response', () => {
    const error = makeAxiosError(400, { title: 'Validation.Failed', detail: 'Correo inválido.' })
    expect(mapForgotPasswordError(error, t)).toBe('Correo inválido.')
  })

  it('falls back to the translated static validation message when detail is absent on a 400', () => {
    const error = makeAxiosError(400, { title: 'Validation.Failed' })
    expect(mapForgotPasswordError(error, t)).toBe('Revisá los datos ingresados.')
  })

  it('returns the translated generic message for a non-axios error', () => {
    expect(mapForgotPasswordError(new Error('boom'), t)).toBe(
      'No pudimos iniciar sesión. Intentá de nuevo en unos minutos.'
    )
  })
})

describe('resetPasswordRequest', () => {
  it('POSTs /auth/password/reset with the full payload and resolves with no meaningful body', async () => {
    let receivedBody: unknown
    server.use(
      http.post(`${baseURL}/auth/password/reset`, async ({ request }) => {
        receivedBody = await request.json()
        return new HttpResponse(null, { status: 200 })
      })
    )

    const payload = { email: 'user@example.com', token: 'tok+en/==', newPassword: 'password123' }
    await expect(resetPasswordRequest(payload)).resolves.toBeUndefined()
    expect(receivedBody).toEqual(payload)
  })
})

describe('mapResetPasswordError', () => {
  it('returns the translated network-error message when the request has no response', () => {
    expect(mapResetPasswordError(makeNoResponseAxiosError(), t)).toBe(
      'No pudimos conectar con el servidor. Intentá de nuevo.'
    )
  })

  it('returns the translated invalid-reset-token message for a 401 / Identity.InvalidResetToken, never the raw server detail', () => {
    const error = makeAxiosError(401, {
      title: 'Identity.InvalidResetToken',
      detail: 'raw server detail that must never leak',
    })
    expect(mapResetPasswordError(error, t)).toBe(
      'Este enlace ya no es válido o expiró. Solicitá uno nuevo.'
    )
  })

  it('passes through the real server detail for a 400 / Validation.Failed response', () => {
    const error = makeAxiosError(400, {
      title: 'Validation.Failed',
      detail: 'La nueva contraseña es inválida.',
    })
    expect(mapResetPasswordError(error, t)).toBe('La nueva contraseña es inválida.')
  })

  it('falls back to the translated static validation message when detail is absent on a 400', () => {
    const error = makeAxiosError(400, { title: 'Validation.Failed' })
    expect(mapResetPasswordError(error, t)).toBe('Revisá los datos ingresados.')
  })

  it('returns the translated rate-limited message for a 429 response', () => {
    const error = makeAxiosError(429, {})
    expect(mapResetPasswordError(error, t)).toBe('Demasiados intentos. Probá de nuevo más tarde.')
  })

  it('uses the real English dictionary when built with an English t()', () => {
    const error = makeAxiosError(401, { title: 'Identity.InvalidResetToken' })
    expect(mapResetPasswordError(error, tEn)).toBe(
      'This link is no longer valid or has expired. Request a new one.'
    )
  })
})
