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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
