import type { ReactNode } from 'react'
import { TornPanel } from './torn-panel'
import { TopoBackground } from './topo-background'
import { Stamp } from './stamp'

export interface AuthLayoutProps {
  /** Encabezado del panel de formulario — oculto en móvil, visible desde `md`. */
  title: string
  /** Tagline del panel oscuro — solo visible en escritorio (`lg`), ver sección "auth" del design system. */
  tagline?: string
  /** Coordenadas mono — solo se muestran en el encabezado móvil. */
  coordinates: string
  /** Texto corto del sello en móvil, ej. "MED". */
  city: string
  /** Línea extra del sello desde `md`, ej. "LAURELES" (se combina con `city`). */
  neighborhood?: string
  /** Contenido del formulario — se monta una sola vez y se reutiliza en ambos layouts. */
  children: ReactNode
  /** Enlace/acción secundaria bajo el formulario (ej. "Crear cuenta"). */
  footer?: ReactNode
}

/**
 * Layout de dos paneles para pantallas de autenticación (login, y futuro registro).
 * Móvil (<768px): una columna, tarjeta con borde rasgado (TornPanel) apilada bajo
 * el wordmark. Desde `md`: panel oscuro (marca + textura topo + sello) a la
 * izquierda y panel claro (formulario) a la derecha — ver design system, sección
 * "auth". El tagline del panel oscuro solo aparece desde `lg` (confirmado en los
 * bocetos de founder, difiere del mock combinado del design system).
 *
 * El formulario (`children`) se renderiza una sola vez; el borde rasgado se logra
 * con una capa decorativa absoluta (TornPanel) que se oculta desde `md`, en vez de
 * duplicar el árbol de inputs por breakpoint.
 */
export function AuthLayout({
  title,
  tagline,
  coordinates,
  city,
  neighborhood,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center bg-cream px-4 py-8 md:justify-center md:p-6">
      <TopoBackground tone="light" className="md:hidden" />

      {/* Encabezado — solo móvil */}
      <div className="relative flex w-full max-w-sm flex-col items-center gap-1 pb-6 text-center md:hidden">
        <h1 className="font-display text-xl text-teal">GeoQuest</h1>
        <span className="font-mono text-[11px] text-muted">{coordinates}</span>
        <Stamp size={40} color="coral" className="absolute right-0 top-0">
          {city}
        </Stamp>
      </div>

      <div className="flex w-full max-w-sm flex-col md:w-full md:max-w-3xl md:flex-row md:overflow-hidden md:rounded-xl md:border md:border-border">
        {/* Panel de marca — desde md */}
        <div className="relative hidden shrink-0 flex-col justify-between overflow-hidden bg-surface-inverse px-7 py-8 text-on-inverse md:flex md:w-[240px] lg:w-[300px]">
          <TopoBackground tone="dark" />
          <div className="relative z-10 flex flex-col gap-2">
            <h2 className="font-display text-2xl text-on-inverse">GeoQuest</h2>
            {tagline && (
              <p className="hidden font-sans text-xs leading-snug text-on-inverse/70 lg:block">
                {tagline}
              </p>
            )}
          </div>
          <Stamp size={64} color="coral" className="relative z-10 self-start">
            {neighborhood ? (
              <>
                {neighborhood}
                <br />
                {city}
              </>
            ) : (
              city
            )}
          </Stamp>
        </div>

        {/* Panel de formulario — tarjeta con borde rasgado en móvil, panel plano desde md */}
        <div className="relative flex-1 overflow-hidden">
          <TornPanel
            edge="top"
            backing="ink"
            className="absolute inset-0 md:hidden"
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col gap-4 px-6 py-7 md:bg-surface-raised md:px-9 md:py-10">
            <h2 className="hidden font-display text-lg text-ink md:block">{title}</h2>
            {children}
            {footer}
          </div>
        </div>
      </div>
    </div>
  )
}
