import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      injectRegister: null, // the React hook registers; no extra inline script
      devOptions: { enabled: false },
      manifest: {
        name: 'GeoQuest',
        short_name: 'GeoQuest',
        description: 'Explora lugares, haz check-in y gana GeoPoints.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#10262B',
        background_color: '#10262B',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell ONLY. No map tiles, no API responses, no Google Fonts CDN
        // (those are cross-origin <link>s and are deliberately NOT precached).
        // PNG is excluded on purpose: manifest icons are fetched at install time.
        globPatterns: ['**/*.{js,css,html}', 'favicon.svg'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html', // SPA fallback (explicit, matches the default)
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Permite acceder al dev server vía el subdominio aleatorio de un
    // Cloudflare quick tunnel (*.trycloudflare.com) para probar en celular.
    // Solo para desarrollo — este archivo no se usa en build de producción.
    allowedHosts: true,
  },
})
