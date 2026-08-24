import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
}

export default defineConfig({
  test: {
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
