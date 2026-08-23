import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
