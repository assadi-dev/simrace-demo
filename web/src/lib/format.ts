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

const integer = new Intl.NumberFormat("fr-FR")
const oneDecimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Entier au format francais : espace fine insecable entre les milliers (48 212). */
export const formatNumber = (value: number) => integer.format(value)

/** Vitesse avec une decimale : `186,9 km/h`. */
export const formatSpeed = (kmh: number) => `${oneDecimal.format(kmh)}\u00a0km/h`

/** Duree ecoulee : `il y a 4 s`, `il y a 3 min`, `il y a 2 h`. Une duree negative (horloges decalees) vaut 0. */
export function formatAgo(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000))
  if (seconds < 60) return `il y a ${seconds}\u00a0s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `il y a ${minutes}\u00a0min`
  return `il y a ${Math.floor(minutes / 60)}\u00a0h`
}
