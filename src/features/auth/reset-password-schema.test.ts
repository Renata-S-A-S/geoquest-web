import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { createResetPasswordSchema } from './reset-password-schema'

/**
 * `createResetPasswordSchema` is a factory for the same reason as
 * `createLoginSchema`/`createRegisterSchema` — zod freezes its message
 * strings at construction time. `i18next.getFixedT` gives a real `t` bound
 * to a fixed language, exercising the actual `auth` dictionary.
 */
describe('createResetPasswordSchema', () => {
  const validPayload = {
    newPassword: 'password123',
    confirmPassword: 'password123',
  }

  it('accepts a fully valid payload', () => {
    const schema = createResetPasswordSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse(validPayload)

    expect(result.success).toBe(true)
  })

  it('rejects a newPassword shorter than 8 characters', () => {
    const schema = createResetPasswordSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ newPassword: 'short', confirmPassword: 'short' })

    expect(result.success).toBe(false)
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'newPassword')?.message
    expect(message).toBe('Mínimo 8 caracteres')
  })

  it('rejects a confirmPassword that does not match newPassword', () => {
    const schema = createResetPasswordSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ ...validPayload, confirmPassword: 'different123' })

    expect(result.success).toBe(false)
    const issue = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'confirmPassword')
    expect(issue?.message).toBe('Las contraseñas no coinciden')
  })

  it('builds a schema with the real English validation messages when given an English t()', () => {
    const schema = createResetPasswordSchema(i18next.getFixedT('en', 'auth'))

    const result = schema.safeParse({ newPassword: 'short', confirmPassword: 'different' })

    expect(result.success).toBe(false)
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message)
    expect(messages).toEqual(['Minimum 8 characters', "Passwords don't match"])
  })
})
