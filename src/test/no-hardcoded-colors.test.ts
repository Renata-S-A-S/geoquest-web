import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for the Tailwind v4 token migration (design D-8): every
 * color must flow through a `--color-*` token, never a literal hex, a
 * functional color function, or a raw Tailwind palette utility.
 *
 * Regex definitions are verbatim from the design artifact's D-8 section.
 */
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/
const FUNCTIONAL_COLOR = /\b(?:rgba?|hsla?)\(/
const WHITE_BLACK_UTILITY =
  /\b(?:bg|text|border|fill|stroke|ring|divide|shadow|outline|decoration|accent|caret|from|via|to|placeholder)-(?:white|black)(?:\/\d+)?\b/
const RAW_PALETTE_UTILITY =
  /\b(?:bg|text|border|fill|stroke|ring|divide|shadow|outline|decoration|accent|caret|from|via|to|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/

const VIOLATION_PATTERNS: Record<string, RegExp> = {
  HEX_LITERAL,
  FUNCTIONAL_COLOR,
  WHITE_BLACK_UTILITY,
  RAW_PALETTE_UTILITY,
}

/**
 * Documents any deliberate exception, keyed by path relative to `src/`.
 * Every literal-dark component role flows through a token (`torn-panel.tsx`
 * reads `var(--color-ink)`, `topo-background.tsx` uses
 * `color-mix(in srgb, var(--color-ink) …)`, `map-view.tsx` uses
 * `shadow-marker`) — design D-8 expected this list to ship empty on that
 * basis. One genuine exception surfaced only once this guard actually ran
 * (design's Verified Facts pass predates `theme.ts` and never audited it):
 * `THEME_COLOR_META` in `shared/lib/theme.ts` must hold literal hex strings
 * because `<meta name="theme-color" content="…">` is a real DOM attribute
 * value, not a Tailwind utility or a CSS custom-property consumer — it
 * cannot read `var(--color-paper)`. A future genuine exception must be added
 * here with a written reason rather than silently regex-excluded.
 */
const ALLOWED_HARDCODED_COLORS: Record<string, string> = {
  'shared/lib/theme.ts':
    'THEME_COLOR_META holds literal hex strings for the <meta name="theme-color"> content attribute (design D-7), which requires a real color string and cannot consume a CSS custom property.',
}

interface Violation {
  path: string
  line: number
  match: string
  rule: string
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
  const files: string[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const parentPath = (entry as { parentPath?: string; path?: string }).parentPath ?? entry.path
    const relativeParent = parentPath.split(/[\\/]src[\\/]?/).pop() ?? ''
    const relativePath = relativeParent
      ? join(relativeParent, entry.name).replace(/\\/g, '/')
      : entry.name

    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
    if (entry.name.endsWith('.d.ts')) continue
    if (relativePath.startsWith('test/')) continue

    files.push(relativePath)
  }

  return files
}

/**
 * `//` only opens a comment when it is not part of a `://` scheme, so a
 * seeded URL such as `http://localhost:9000/...` keeps its content.
 */
function findLineCommentStart(line: string, from: number): number {
  let at = line.indexOf('//', from)
  while (at > 0 && line[at - 1] === ':') {
    at = line.indexOf('//', at + 2)
  }
  return at
}

/**
 * Blanks comment content before scanning, preserving the line count so the
 * reported line numbers still point at the real source lines.
 *
 * A comment cannot render a color, so a hex inside one is never a real
 * violation. An issue reference like `#110` is three hex digits, though, so
 * HEX_LITERAL matched it and failed the build on a doc comment - twice in
 * two PRs, each time worked around by rewording the comment. Rewording does
 * not scale: this repo cites issues in comments as a matter of course.
 */
export function stripComments(lines: string[]): string[] {
  let inBlock = false

  return lines.map((line) => {
    let kept = ''
    let index = 0

    while (index < line.length) {
      if (inBlock) {
        const close = line.indexOf('*/', index)
        if (close === -1) return kept
        inBlock = false
        index = close + 2
        continue
      }

      const blockOpen = line.indexOf('/*', index)
      const lineOpen = findLineCommentStart(line, index)
      const next = Math.min(
        blockOpen === -1 ? Number.POSITIVE_INFINITY : blockOpen,
        lineOpen === -1 ? Number.POSITIVE_INFINITY : lineOpen
      )

      if (next === Number.POSITIVE_INFINITY) {
        return kept + line.slice(index)
      }

      kept += line.slice(index, next)
      if (next === lineOpen) return kept

      inBlock = true
      index = next + 2
    }

    return kept
  })
}

function scanFile(srcDir: string, relativePath: string): Violation[] {
  const content = readFileSync(join(srcDir, relativePath), 'utf-8')
  const lines = stripComments(content.split('\n'))
  const violations: Violation[] = []

  lines.forEach((line, index) => {
    for (const [rule, pattern] of Object.entries(VIOLATION_PATTERNS)) {
      const match = line.match(pattern)
      if (match) {
        violations.push({ path: relativePath, line: index + 1, match: match[0], rule })
      }
    }
  })

  return violations
}

const srcDir = join(process.cwd(), 'src')
const sourceFiles = collectSourceFiles(srcDir)

const allViolations = sourceFiles.flatMap((path) => scanFile(srcDir, path))

const unallowedViolations = allViolations.filter(
  (violation) => !(violation.path in ALLOWED_HARDCODED_COLORS)
)

describe('stripComments', () => {
  it('blanks an issue reference inside a block comment', () => {
    const lines = [
      '/**',
      ' * Deletion copy, see issue #110 for the rationale.',
      ' */',
      'const a = 1',
    ]

    expect(stripComments(lines).join(' ')).not.toContain('#110')
  })

  it('keeps a hex literal that is real code', () => {
    const lines = ["export const paper = '#F6F3EC'"]

    expect(stripComments(lines)[0]).toContain('#F6F3EC')
  })

  it('does not treat the // in a url scheme as a comment', () => {
    const lines = ["const seed = 'http://localhost:9000/geoquest/#F6F3EC.jpg'"]

    expect(stripComments(lines)[0]).toContain('#F6F3EC')
  })

  it('blanks a trailing line comment but keeps the code before it', () => {
    const lines = ["const paper = '#F6F3EC' // fallback #110"]
    const [stripped] = stripComments(lines)

    expect(stripped).toContain('#F6F3EC')
    expect(stripped).not.toContain('#110')
  })

  it('keeps code that follows a block comment closing mid-line', () => {
    const lines = ["/* see #110 */ const ink = '#0A1618'"]
    const [stripped] = stripComments(lines)

    expect(stripped).not.toContain('#110')
    expect(stripped).toContain('#0A1618')
  })

  it('preserves the line count so reported line numbers stay correct', () => {
    const lines = ['/**', ' * #110', ' */', 'const a = 1']

    expect(stripComments(lines)).toHaveLength(4)
  })
})

describe('no-hardcoded-colors static scan', () => {
  /**
   * Sentinel. A static scan that silently stops finding files would pass
   * forever while guarding nothing — `flatMap` over an empty file list yields
   * no violations, and "no violations" is exactly what this suite asserts.
   *
   * The stale-entry test below is not a substitute: it only bites while
   * `ALLOWED_HARDCODED_COLORS` still has a live entry, so it stops protecting
   * the scan the moment `theme.ts`'s hex literals migrate to tokens. The
   * anchor here is deliberately a structural file rather than an allow-listed
   * one, so removing an allow-list entry cannot disarm the sentinel.
   */
  it('actually scans the source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
    expect(sourceFiles).toContain('app/routes.tsx')
  })

  it('finds no hardcoded hex, functional-color, or raw-palette utility outside the allow-list', () => {
    const message = unallowedViolations
      .map((v) => `${v.path}:${v.line} [${v.rule}] matched "${v.match}"`)
      .join('\n')

    expect(unallowedViolations, message).toHaveLength(0)
  })

  it('has no stale allow-list entry (every entry must still be a genuine violation)', () => {
    const violatingPaths = new Set(allViolations.map((v) => v.path))
    const staleEntries = Object.keys(ALLOWED_HARDCODED_COLORS).filter(
      (path) => !violatingPaths.has(path)
    )

    expect(
      staleEntries,
      `Stale allow-list entries (no longer violate): ${staleEntries.join(', ')}`
    ).toHaveLength(0)
  })
})
