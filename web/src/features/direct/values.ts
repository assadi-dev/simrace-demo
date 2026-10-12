import type { Sample } from "@/contracts/telemetry"
import type { Lap, StationHistory } from "@/features/direct/history"
import {
  formatDecimal,
  formatLapTime,
  formatNumber,
  NOT_AVAILABLE,
} from "@/lib/format"

export type Kpi = { label: string; value: string; help: string }

/** Rapport ACC apres correction de l'agent : -1 marche arriere, 0 point mort. */
export const gearLabel = (gear: number) =>
  gear === -1 ? "R" : gear === 0 ? "N" : String(gear)

const setting = (value: number | null | undefined) =>
  value == null ? NOT_AVAILABLE : String(value)

const NOT_SENT = "Non transmis par l'agent"

/** Numero du tour (dans l'historique vu) qui a donne ce temps, s'il y en a un. */
const lapWithTime = (laps: readonly Lap[], timeMs: number) =>
  laps.findLast((lap) => lap.timeMs === timeMs)?.number

/** Les six KPI de la maquette 2, tires du dernier echantillon. */
export function directKpis(sample: Sample, history: StationHistory): Kpi[] {
  const tc = [sample.tc_level, sample.tc_cut_level]
  const bestLap = sample.best_lap_ms
    ? lapWithTime(history.laps, sample.best_lap_ms)
    : undefined
  return [
    {
      label: "TC · TC Cut",
      value: tc.map(setting).join(" · "),
      help: tc.every((v) => v == null) ? NOT_SENT : "Réglages lus dans ACC",
    },
    {
      label: "ABS",
      value: setting(sample.abs_level),
      help: sample.abs_level == null ? NOT_SENT : "Réglage lu dans ACC",
    },
    {
      label: "Map moteur",
      value: setting(sample.engine_map),
      help:
        sample.engine_map == null ? NOT_SENT : "Numérotée comme dans le jeu",
    },
    {
      label: "Tour en cours",
      value: String(sample.completed_laps + 1),
      help: formatLapTime(sample.lap_time_ms),
    },
    {
      label: "Dernier tour",
      value: formatLapTime(sample.last_lap_ms),
      help:
        sample.completed_laps > 0
          ? `Tour ${sample.completed_laps}`
          : "Aucun tour terminé",
    },
    {
      label: "Meilleur tour",
      value: formatLapTime(sample.best_lap_ms),
      help: bestLap ? `Tour ${bestLap}` : "Selon ACC",
    },
  ]
}

export type GaugeStat = {
  label: string
  value: string
  unit: string
  help: string
}

/** Les trois mini-cartes a gauche de la jauge. Distance et moyenne sont calculees par le front. */
export function gaugeStats(
  sample: Sample,
  history: StationHistory
): GaugeStat[] {
  const { distanceM, drivenMs } = history.trip
  const average =
    drivenMs > 0 ? distanceM / 1000 / (drivenMs / 3_600_000) : null
  return [
    {
      label: "Rapport",
      value: gearLabel(sample.gear),
      unit: "",
      help: "Marche arrière = R, point mort = N",
    },
    {
      label: "Distance parcourue",
      value: formatDecimal(distanceM / 1000, 2),
      unit: "km",
      help: "Calculée : vitesse × temps entre échantillons, depuis la remise à zéro",
    },
    {
      label: "Vitesse moyenne",
      value:
        average == null ? NOT_AVAILABLE : formatNumber(Math.round(average)),
      unit: average == null ? "" : "km/h",
      help: "Calculée : distance ÷ temps roulé",
    },
  ]
}
