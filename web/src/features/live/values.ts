import type { Sample } from "@/contracts/telemetry"
import { gearLabel } from "@/features/direct/values"
import type { VideoState } from "@/features/live/use-station-video"
import type { StationStatus } from "@/features/stations/status"
import { liveValues } from "@/features/stations/summary"
import { formatNumber, NOT_AVAILABLE } from "@/lib/format"

/*
 * Textes des surimpressions de la page Live (maquettes 5, 6 et 7). Ils viennent du flux /stream,
 * jamais de la video. Hors ligne, rien n'est "en direct" : n.d.
 */

/** Dernier echantillon s'il est encore "en direct", sinon undefined. */
const liveSample = (status: StationStatus, sample: Sample | undefined) =>
  status === "offline" ? undefined : sample

/** Vitesse arrondie au km/h (`187`), pour les surimpressions. */
export function roundedSpeed(
  status: StationStatus,
  sample: Sample | undefined
): string {
  const live = liveSample(status, sample)
  return live ? formatNumber(Math.round(live.speed_kmh)) : NOT_AVAILABLE
}

/** Pastille du bas de la video : `187 km/h · Tour 2 · 0:55,200`. */
export function overlayTelemetry(
  status: StationStatus,
  sample: Sample | undefined
): string {
  if (!liveSample(status, sample)) return `Télémétrie ${NOT_AVAILABLE}`
  const values = liveValues(status, sample)
  return [
    `${roundedSpeed(status, sample)}\u00a0km/h`,
    values.lapLabel,
    values.lapTime,
  ].join(" · ")
}

export type LiveStat = {
  label: string
  value: string
  /** Valeur absente (n.d.) : affichee en gris. */
  muted: boolean
}

/**
 * Valeurs de la vue en grand et du plein ecran. Le delta compare le dernier tour au meilleur
 * tour precedent : il faut l'historique des tours, que la page Live ne garde pas encore (n.d.).
 */
export function liveStats(
  status: StationStatus,
  sample: Sample | undefined,
  { withSpeed }: { withSpeed: boolean }
): LiveStat[] {
  const values = liveValues(status, sample)
  const live = liveSample(status, sample)
  const stats = [
    ...(withSpeed ? [{ label: "Vitesse", value: values.speed }] : []),
    {
      label: "Rapport · tr/min",
      value: live
        ? `${gearLabel(live.gear)} · ${formatNumber(live.rpm)}`
        : NOT_AVAILABLE,
    },
    { label: `${values.lapLabel} · temps actuel`, value: values.lapTime },
    { label: "Tour précédent", value: values.lastLap },
    { label: "Meilleur tour", value: values.bestLap },
    { label: "Delta", value: NOT_AVAILABLE },
  ]
  return stats.map((stat) => ({
    ...stat,
    muted: stat.value === NOT_AVAILABLE,
  }))
}

export type VideoOverlay = {
  kind: "loading" | "unavailable" | "paused"
  text: string
} | null

const unavailable = (reason: string): VideoOverlay => ({
  kind: "unavailable",
  text: `Flux indisponible : ${reason}`,
})

/**
 * Ce qui recouvre la video d'un poste. Un flux absent ou en erreur l'emporte : on montre
 * l'etat, jamais une image qui laisserait croire a un flux. Le chargement n'est affiche qu'a la
 * premiere connexion (les nouveaux essais gardent l'etat d'erreur, sans clignoter).
 * `hasPoster` : en demo (pas de serveur video), l'affiche du poste tient lieu d'image.
 */
export function videoOverlay(
  status: StationStatus,
  state: VideoState,
  hasPoster: boolean
): VideoOverlay {
  if (status === "offline") return unavailable("poste hors ligne")
  if (state.kind === "error") return unavailable(state.reason)
  if (state.kind === "demo" && !hasPoster)
    return unavailable("serveur vidéo non configuré")
  if (state.kind === "connecting")
    return { kind: "loading", text: "Connexion au flux…" }
  if (status === "paused")
    return { kind: "paused", text: "Session en pause, image figée" }
  return null
}
