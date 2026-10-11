/** Valeur non fournie par l'API : on l'affiche, on ne l'invente jamais (design.md 1.6). */
export const NOT_AVAILABLE = "n.d."

/** Temps de tour au format `m:ss,mmm`. `null` ou 0 (inconnu cote agent) donne `n.d.`. */
export function formatLapTime(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return NOT_AVAILABLE
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const millis = ms % 1000
  return `${minutes}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`
}
