import { z } from "zod"

/*
 * Configuration du front, lue dans les variables VITE_* (.env, .env.local) et validee par Zod :
 * une valeur invalide arrete l'application au demarrage avec un message clair.
 */
const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value)

const envSchema = z.object({
  /** URL du serveur FastAPI. */
  VITE_API_URL: z.preprocess(
    emptyAsUndefined,
    z.url().default("http://localhost:8000")
  ),
  /** Nombre de postes du centre (KPI "Postes en ligne N / max"). Absent ou vide = 1. */
  VITE_MAX_STATIONS: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().positive().default(1)
  ),
  /**
   * Hote du serveur MediaMTX (decision 0019), sans schema ni port : `10.192.2.241`. Les ports
   * WebRTC et HLS sont ceux de la decision. Absent ou vide = pas de video, affiches seulement.
   */
  VITE_MEDIA_HOST: z.preprocess(
    emptyAsUndefined,
    z
      .string()
      .regex(/^[A-Za-z0-9.-]+$/, "hote seul, sans http:// ni port")
      .optional()
  ),
})

export function parseConfig(env: Record<string, unknown>) {
  const parsed = envSchema.parse(env)
  return {
    apiUrl: parsed.VITE_API_URL.replace(/\/+$/, ""),
    maxStations: parsed.VITE_MAX_STATIONS,
    mediaHost: parsed.VITE_MEDIA_HOST ?? null,
  }
}

export const config = parseConfig(import.meta.env)
