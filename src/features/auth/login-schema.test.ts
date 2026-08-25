import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { createLoginSchema } from './login-schema'

/**
 * `createLoginSchema` is a factory (not a static schema) because zod messages
 * are frozen at schema-construction time — a static top-level schema could
 * never re-translate when the active language changes (WU11 PR2, auth i18n
 * migration). `i18next.getFixedT` gives a real `t` bound to a fixed language,
 * exercising the actual `auth` dictionary instead of a stub.
 */
describe('createLoginSchema', () => {
  it('rejects an invalid email with the real Spanish validation message', () => {
    const schema = createLoginSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ email: 'not-an-email', password: 'password123' })

    expect(result.success).toBe(false)
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe(
      'Ingresá un correo válido'
    )
  })

  it('rejects a too-short password with the real Spanish validation message', () => {
    const schema = createLoginSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ email: 'user@example.com', password: 'short' })

    expect(result.success).toBe(false)
    expect(result.success ? undefined : result.error.issues[0]?.message).toBe('Mínimo 8 caracteres')
  })

  it('builds a schema with the real English validation messages when given an English t()', () => {
    const schema = createLoginSchema(i18next.getFixedT('en', 'auth'))

    const result = schema.safeParse({ email: 'nope', password: 'short' })

    expect(result.success).toBe(false)
    expect(result.success ? undefined : result.error.issues.map((issue) => issue.message)).toEqual([
      'Enter a valid email',
      'Minimum 8 characters',
    ])
  })

  it('accepts a valid email and an 8+ character password', () => {
    const schema = createLoginSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ email: 'user@example.com', password: 'password123' })

    expect(result.success).toBe(true)
  })
})
