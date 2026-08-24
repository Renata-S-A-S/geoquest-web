import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
}

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/app/routes.tsx',
        'src/test/**',
        'src/**/*.d.ts',
        'src/vite-env.d.ts',
        'src/**/*.test.{ts,tsx}',
      ],
      // Baseline measured on 2026-08-24 with `npm run test:coverage` (no
      // thresholds), clean `npm ci`: statements 70.57%, branches 60.18%,
      // functions 61.61%, lines 72.19%. enforced = min(target, floor(measured/5)*5).
      // ratchet target: 60/60/60/50 (statements/lines/functions/branches).
      // Never lower these numbers to force a red build green again.
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.*'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup-dom.ts'],
        },
      },
    ],
  },
})
