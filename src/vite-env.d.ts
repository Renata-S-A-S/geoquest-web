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
   * Overrides para el lugar semilla del flujo de check-in demo (WU9, issue
   * #9) — ver `src/features/checkin/checkin-config.ts`. Sin ellos, el
   * fallback de desarrollo apunta al lugar semilla confirmado contra el
   * backend local.
   */
  readonly VITE_SEED_PLACE_ID?: string
  readonly VITE_SEED_PLACE_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
