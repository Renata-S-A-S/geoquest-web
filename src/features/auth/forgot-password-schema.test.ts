import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { createForgotPasswordSchema } from './forgot-password-schema'

/**
 * `createForgotPasswordSchema` is a factory (not a static schema) for the
 * same reason as `createLoginSchema`: zod messages are frozen at
 * schema-construction time, so a static top-level schema could never
 * re-translate when the active language changes. `i18next.getFixedT` gives a
 * real `t` bound to a fixed language, exercising the actual `auth`
 * dictionary instead of a stub.
 */
describe('createForgotPasswordSchema', () => {
  it('rejects an invalid email with the real Spanish validation message', () => {
    const schema = createForgotPasswordSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ email: 'not-an-email' })

    expect(result.success).toBe(false)
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe(
      'Ingresá un correo válido'
    )
  })

  it('builds a schema with the real English validation message when given an English t()', () => {
    const schema = createForgotPasswordSchema(i18next.getFixedT('en', 'auth'))

    const result = schema.safeParse({ email: 'nope' })

    expect(result.success).toBe(false)
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe('Enter a valid email')
  })

  it('accepts a valid email', () => {
    const schema = createForgotPasswordSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ email: 'user@example.com' })

    expect(result.success).toBe(true)
  })
})
