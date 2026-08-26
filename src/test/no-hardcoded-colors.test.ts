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

function scanFile(srcDir: string, relativePath: string): Violation[] {
  const content = readFileSync(join(srcDir, relativePath), 'utf-8')
  const lines = content.split('\n')
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

describe('no-hardcoded-colors static scan', () => {
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

    expect(staleEntries, `Stale allow-list entries (no longer violate): ${staleEntries.join(', ')}`).toHaveLength(
      0
    )
  })
})
