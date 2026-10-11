/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du serveur FastAPI (CORS : localhost:5173 est autorise par defaut). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
