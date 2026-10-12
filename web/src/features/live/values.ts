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

/** Libelle de la pastille du protocole : etat de la lecture, latence non mesuree (n.d.). */
export function videoLabel(protocol: string, state: VideoState): string {
  switch (state.kind) {
    case "playing":
      return `${protocol} · latence n.d.`
    case "connecting":
      return `${protocol} · connexion…`
    case "error":
      return `${protocol} · ${state.reason}`
    case "off":
      return `${protocol} · pas de flux`
    case "demo":
      return `${protocol} · image de démo`
  }
}
