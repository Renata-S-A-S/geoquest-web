import { type HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export interface TornPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** `top`: borde rasgado arriba (modales, tarjetas). `right`: borde rasgado a la derecha (panel lateral de auth). */
  edge?: 'top' | 'right'
  /**
   * Color de "eco" a lo largo del borde rasgado — un wrapper propio lleva
   * `filter: drop-shadow()` alrededor del panel recortado. `drop-shadow` traza
   * la silueta ya recortada por `clip-path` como una línea fina — a diferencia
   * de un `box-shadow` (sigue la caja, no el recorte) o de una segunda capa
   * duplicada (o se tapa por completo, o se ve como un bloque grueso; ambas
   * variantes se probaron y se descartaron). Importante: el filtro NO puede
   * vivir en el MISMO elemento que el `clip-path` — el navegador aplica
   * clip-path después del filtro y recorta la sombra al mismo polígono, así
   * que nunca asoma nada (verificado empíricamente); por eso el wrapper existe.
   * También verificado: usar VARIOS `drop-shadow()` apilados en direcciones
   * distintas (probado con 3) NO da un trazo más parejo — se encadenan (cada
   * uno hace sombra del resultado del anterior, no una copia independiente
   * del original) y el resultado se ve como un bloque grueso sin importar
   * cuánto se reduzca cada desplazamiento individual. Por eso un solo
   * `drop-shadow()` es la versión correcta, no una simplificación de emergencia.
   * El desplazamiento va hacia el lado que el `clip-path` deja transparente
   * (arriba para `edge="top"`), así que no aparece ninguna línea en los bordes
   * rectos (abajo/lados). `undefined` (default) = sin wrapper ni filtro extra,
   * mismo comportamiento de siempre. OJO: `filter` en un elemento lo convierte
   * en containing block de sus descendientes `position: absolute` (igual que
   * `transform`) — verificado empíricamente que esto rompe usos "decorativos"
   * sin hijos (ej. `AuthLayout`, panel con `className="absolute inset-0 ..."`
   * y sin children): si el wrapper del filtro no tiene tamaño propio, colapsa
   * a 0 y el panel recortado desaparece. Por eso el componente distingue dos
   * casos internamente — con hijos (modal/tarjeta con contenido, sizeado por
   * su propio padding en flujo normal, ej. `ConfirmationModal`) vs. sin hijos
   * (capa puramente decorativa en flujo absoluto, ej. `AuthLayout`) — sin que
   * el caller tenga que pensar en esto; alcanza con pasar `backing`.
   *
   * Este tratamiento (hairline vía `drop-shadow`, no bloque/segunda capa) es
   * el estándar para CUALQUIER modal o tarjeta con borde rasgado de acá en
   * adelante (ej. el futuro modal de detalle de insignia del design system,
   * todavía sin construir) — no reinventar una versión propia por pantalla.
   */
  backing?: 'ink' | 'coral' | 'teal'
}

/**
 * Pieza de firma visual #1 del design system: "borde rasgado" — clip-path irregular
 * tipo página arrancada. Es la única pieza de "apuesta" del sistema; los valores del
 * polígono son exactamente los de geoquest-design-system-v1.html (.torn-top / .torn-right).
 * No usar radios redondeados perfectos en su lugar.
 */
const clipPaths = {
  top: 'polygon(0% 4%,6% 1%,12% 4%,18% 1%,24% 3%,30% 1%,36% 4%,42% 1%,48% 3%,54% 1%,60% 4%,66% 1%,72% 3%,78% 1%,84% 4%,90% 1%,96% 3%,100% 1%,100% 100%,0% 100%)',
  right:
    'polygon(0% 0%,92% 0%,97% 4%,90% 8%,97% 12%,90% 16%,97% 20%,90% 24%,97% 28%,90% 32%,97% 36%,90% 40%,97% 44%,90% 48%,97% 52%,90% 56%,97% 60%,90% 64%,97% 68%,90% 72%,97% 76%,90% 80%,97% 84%,90% 88%,97% 92%,92% 96%,0% 100%)',
} as const

/** Hex 1:1 con `tailwind.config.ts` — `filter` no puede resolver tokens de Tailwind. */
const backingHex = {
  ink: '#10262B',
  coral: '#FF7A59',
  teal: '#0EA5A0',
} as const

/**
 * Desplazamiento (x, y) en px del único `drop-shadow()` — hairline, no bloque.
 * Apunta hacia el lado transparente del recorte (arriba para `edge="top"`).
 * Verificado a ojo en 3x (ver PR/reporte): 1px se ve como una línea fina y
 * pareja incluso en los segmentos más angulados del zigzag; valores más
 * chicos (0.2–0.75px) se ven casi idénticos por el antialiasing del propio
 * `clip-path`, así que no vale la pena bajar más. Si se necesita más o menos
 * presencia, ajustar ESTE único valor — no volver a apilar varios shadows.
 */
const backingOffsets = {
  top: [0, -1],
  right: [1, 0],
} as const

function backingFilter(edge: 'top' | 'right', color: string) {
  const [x, y] = backingOffsets[edge]
  return `drop-shadow(${x}px ${y}px 0 ${color})`
}

export function TornPanel({ edge = 'top', backing, className, style, children, ...props }: TornPanelProps) {
  const clipStyle = { clipPath: clipPaths[edge] }

  if (!backing) {
    return (
      <div
        className={cn('relative bg-white', className)}
        style={{ ...clipStyle, ...style }}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (children) {
    // Caso "con contenido": el panel sigue en flujo normal (solo `relative`,
    // nunca `absolute`), así que no dispara el colapso — el wrapper del
    // filtro no necesita tamaño propio.
    return (
      <div style={{ filter: backingFilter(edge, backingHex[backing]) }}>
        <div
          className={cn('relative bg-white', className)}
          style={{ ...clipStyle, ...style }}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  }

  // Caso "decorativo" (sin hijos): `className` (con el posicionamiento, ej.
  // `absolute inset-0`) va en el WRAPPER para que tenga tamaño propio como
  // containing block; el panel interno solo se estira a `h-full w-full`.
  return (
    <div className={className} style={{ filter: backingFilter(edge, backingHex[backing]) }} {...props}>
      <div className="relative h-full w-full bg-white" style={{ ...clipStyle, ...style }} />
    </div>
  )
}
