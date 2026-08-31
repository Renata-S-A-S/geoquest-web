import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { createRegisterSchema } from './register-schema'

/**
 * `createRegisterSchema` is a factory (not a static schema) for the same
 * reason as `createLoginSchema`: zod messages are frozen at
 * schema-construction time, so a static top-level schema could never
 * re-translate when the active language changes. `i18next.getFixedT` gives
 * a real `t` bound to a fixed language, exercising the actual `auth`
 * dictionary instead of a stub.
 */
describe('createRegisterSchema', () => {
  const validPayload = {
    email: 'user@example.com',
    username: 'valid_user1',
    password: 'password123',
    confirmPassword: 'password123',
  }

  it('accepts a fully valid payload', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse(validPayload)

    expect(result.success).toBe(true)
  })

  it('rejects an invalid email with the real Spanish validation message', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ ...validPayload, email: 'not-an-email' })

    expect(result.success).toBe(false)
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'email')?.message
    expect(message).toBe('Ingresá un correo válido')
  })

  it('rejects an email longer than 256 characters', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))
    const tooLongEmail = `${'a'.repeat(250)}@example.com`
    expect(tooLongEmail.length).toBeGreaterThan(256)

    const result = schema.safeParse({ ...validPayload, email: tooLongEmail })

    expect(result.success).toBe(false)
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'email')?.message
    expect(message).toBe('Ingresá un correo válido')
  })

  it('rejects a username with characters outside letters, numbers, and underscore', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ ...validPayload, username: 'invalid name!' })

    expect(result.success).toBe(false)
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'username')?.message
    expect(message).toBe(
      'El nombre de usuario debe tener 3 a 20 caracteres: letras, números o guion bajo'
    )
  })

  it('rejects a username shorter than 3 characters', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ ...validPayload, username: 'ab' })

    expect(result.success).toBe(false)
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'username')?.message
    expect(message).toBe(
      'El nombre de usuario debe tener 3 a 20 caracteres: letras, números o guion bajo'
    )
  })

  it('rejects a username longer than 20 characters', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ ...validPayload, username: 'a'.repeat(21) })

    expect(result.success).toBe(false)
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'username')?.message
    expect(message).toBe(
      'El nombre de usuario debe tener 3 a 20 caracteres: letras, números o guion bajo'
    )
  })

  it('rejects a password shorter than 8 characters', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({
      ...validPayload,
      password: 'short',
      confirmPassword: 'short',
    })

    expect(result.success).toBe(false)
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'password')?.message
    expect(message).toBe('Mínimo 8 caracteres')
  })

  it('rejects a confirmPassword that does not match password', () => {
    const schema = createRegisterSchema(i18next.getFixedT('es', 'auth'))

    const result = schema.safeParse({ ...validPayload, confirmPassword: 'different123' })

    expect(result.success).toBe(false)
    const issue = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === 'confirmPassword')
    expect(issue?.message).toBe('Las contraseñas no coinciden')
  })

  it('builds a schema with the real English validation messages when given an English t()', () => {
    const schema = createRegisterSchema(i18next.getFixedT('en', 'auth'))

    const result = schema.safeParse({
      email: 'nope',
      username: 'no',
      password: 'short',
      confirmPassword: 'different',
    })

    expect(result.success).toBe(false)
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message)
    expect(messages).toEqual([
      'Enter a valid email',
      'Username must be 3–20 characters: letters, numbers, or underscore',
      'Minimum 8 characters',
      "Passwords don't match",
    ])
  })
})
