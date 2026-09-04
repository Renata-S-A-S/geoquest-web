import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Repo guard for the auth-session domain (spec #1217, "Server-only session
 * origin"): the auth store must only ever be populated by a real backend
 * response, never by a client-fabricated stub. `handleGoogleContinue` used to
 * write literal fake tokens into the store as an authentication bypass
 * (product decision #1215.2) — this guard fails the build if either literal
 * ever returns to `src/features/auth/**`.
 *
 * Modeled on the `no-hardcoded-colors.test.ts` precedent: a static scan is
 * cheaper and more reliable than a runtime interaction test for a
 * static-shape guarantee like "this literal must never exist."
 */
const STUB_TOKEN_LITERALS = ['stub-google-access-token', 'stub-google-refresh-token'] as const

interface Violation {
  path: string
  line: number
  literal: string
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
  const files: string[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const parentPath = (entry as { parentPath?: string; path?: string }).parentPath ?? entry.path
    const relativeParent = parentPath.split(/[\\/]auth[\\/]?/).pop() ?? ''
    const relativePath = relativeParent
      ? join(relativeParent, entry.name).replace(/\\/g, '/')
      : entry.name

    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
    if (entry.name.endsWith('.d.ts')) continue

    files.push(relativePath)
  }

  return files
}

function scanFile(authDir: string, relativePath: string): Violation[] {
  const content = readFileSync(join(authDir, relativePath), 'utf-8')
  const lines = content.split('\n')
  const violations: Violation[] = []

  lines.forEach((line, index) => {
    for (const literal of STUB_TOKEN_LITERALS) {
      if (line.includes(literal)) {
        violations.push({ path: relativePath, line: index + 1, literal })
      }
    }
  })

  return violations
}

const authDir = join(process.cwd(), 'src', 'features', 'auth')
const sourceFiles = collectSourceFiles(authDir)
const violations = sourceFiles.flatMap((path) => scanFile(authDir, path))

describe('no-stub-auth-tokens static scan', () => {
  /**
   * Sentinel. A static scan that silently stops finding files would pass
   * forever while guarding nothing — the fail-open mode that matters most for
   * a security guard. Any refactor that moves the auth slice or changes how
   * `collectSourceFiles` walks it must fail here rather than go unnoticed.
   */
  it('actually scans the auth source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
    expect(sourceFiles).toContain('login-page.tsx')
  })

  it('finds no stub Google token literals under src/features/auth', () => {
    const message = violations
      .map((v) => `${v.path}:${v.line} contains stub literal "${v.literal}"`)
      .join('\n')

    expect(violations, message).toHaveLength(0)
  })
})
