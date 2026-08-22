import type { Config } from 'tailwindcss'

/**
 * Tokens extraídos de geoquest-design-system-v1.html (22 ago 2026).
 * Fuente de verdad visual hasta que exista arte final de un diseñador.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de marca (6 colores del design system)
        teal: '#0EA5A0', // Explorer teal — marca, botón primario, nav activa
        coral: '#FF7A59', // Sunset coral — celebración, XP, badges, racha
        green: '#3ECF8E', // Spring green — estados de éxito
        ink: '#10262B', // Jungle ink — texto principal, fondos oscuros (rail, cámara)
        cream: '#FFF9F2', // Cloud cream — fondo claro por defecto
        alert: '#E5484D', // Alert red — SOLO destructivo/error, nunca marca

        // Neutros de soporte
        border: '#E4DFD4',
        muted: '#8A8578',
        paper: '#F6F3EC',

        // Tokens de superficie por escenario (tintes usados en el design system)
        surface: {
          mint: '#E1F0E6', // fondo de mapa / superficies de éxito
          teal: '#E1F5EE', // fondo de pill de categoría (ej. "Café")
          alert: '#FDECEC', // fondo de toast de error
          skeleton: '#E9E5DC', // placeholders de carga
          placeholder: '#DCD6C8', // placeholder de imagen de lugar
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'sans-serif'], // wordmark, encabezados
        sans: ['"Nunito"', 'sans-serif'], // texto de interfaz
        mono: ['"Space Mono"', 'monospace'], // datos: puntos, distancias, coordenadas
      },
      borderRadius: {
        xs: '8px', // inputs
        sm: '10px', // botones, swatches
        md: '12px', // cards
        lg: '16px', // pills, modal
        xl: '18px', // superficies grandes (mapa, panel de auth)
      },
      screens: {
        // Corte de navegación confirmado en el design system: 1024px (lg de Tailwind), no 768px.
      },
    },
  },
  plugins: [],
} satisfies Config
