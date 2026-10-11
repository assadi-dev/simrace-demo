/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du serveur FastAPI (CORS : localhost:5173 est autorise par defaut). */
  readonly VITE_API_URL?: string
  /** Nombre de postes du centre (KPI "Postes en ligne"). */
  readonly VITE_MAX_STATIONS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
