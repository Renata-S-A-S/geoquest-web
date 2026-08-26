import { describe, expect, it } from 'vitest'
import { isThemeMode, resolveTheme, THEME_MODES } from './theme'

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('resolveTheme(%s, prefersDark=%s) -> %s', (mode, prefersDark, expected) => {
    expect(resolveTheme(mode, prefersDark)).toBe(expected)
  })
})

describe('isThemeMode', () => {
  it.each(THEME_MODES)('accepts %s', (mode) => {
    expect(isThemeMode(mode)).toBe(true)
  })

  it.each(['auto', 'Light', '', null, undefined, 0, 1, {}, [], ['light']])(
    'rejects %j',
    (value) => {
      expect(isThemeMode(value)).toBe(false)
    }
  )
})
