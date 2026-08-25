/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL del backend (GeoQuest API). En un deploy real esto se configura
   * como variable de entorno real (`.env.local` / CI) — ver el fallback de
   * desarrollo en `src/shared/lib/api-client.ts` para cuando no está seteada.
   */
  readonly VITE_API_BASE_URL?: string

  /** Token público de Mapbox (mapa de check-ins, WU10) — ver react-map-gl/mapbox-gl. */
  readonly VITE_MAPBOX_TOKEN?: string

  /**
   * Overrides para el centro por defecto del mapa (WU003b) cuando el GPS del
   * dispositivo se deniega o expira — ver `src/features/map/map-config.ts`.
   * Ambos deben estar presentes y ser números válidos para tomar efecto; si
   * falta alguno o no son parseables, el fallback es Medellín.
   */
  readonly VITE_MAP_DEFAULT_LAT?: string
  readonly VITE_MAP_DEFAULT_LNG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
