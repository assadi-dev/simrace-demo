import type { Station } from "@/contracts/stations"
import type { Sample } from "@/contracts/telemetry"
import type { StationStatus } from "@/features/stations/status"
import {
  formatLapTime,
  formatNumber,
  formatSpeed,
  NOT_AVAILABLE,
} from "@/lib/format"

/** Tri de la page Postes : en ligne d'abord, puis par identifiant. */
export function sortStations(stations: readonly Station[]): Station[] {
  return [...stations].sort(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      a.station_id.localeCompare(b.station_id)
  )
}

/** KPI globaux : somme des compteurs d'integrite de tous les postes. */
export function summarizeStations(stations: readonly Station[]) {
  return stations.reduce(
    (total, s) => ({
      total: total.total + 1,
      online: total.online + Number(s.online),
      samples: total.samples + s.samples,
      duplicates: total.duplicates + s.duplicates,
      gaps: total.gaps + s.gaps,
      rejected: total.rejected + s.rejected,
    }),
    { total: 0, online: 0, samples: 0, duplicates: 0, gaps: 0, rejected: 0 }
  )
}

export type LiveValues = {
  speed: string
  gearRpm: string
  lapLabel: string
  lapTime: string
  lastLap: string
  position: string
  /** 0 a 100, pour la barre de progression. */
  positionPercent: number
}

/**
 * Valeurs en direct d'une carte, tirees du dernier echantillon du flux (pas de /stations).
 * Hors ligne : seul le dernier tour reste affiche, le reste n'est plus "en direct".
 */
export function liveValues(
  status: StationStatus,
  sample: Sample | undefined
): LiveValues {
  if (!sample || status === "offline") {
    return {
      speed: NOT_AVAILABLE,
      gearRpm: NOT_AVAILABLE,
      lapLabel: `Tour ${NOT_AVAILABLE}`,
      lapTime: NOT_AVAILABLE,
      lastLap: formatLapTime(sample?.last_lap_ms),
      position: NOT_AVAILABLE,
      positionPercent: 0,
    }
  }
  const percent = Math.round(sample.track_pos * 100)
  return {
    speed: formatSpeed(sample.speed_kmh),
    gearRpm: `${sample.gear} · ${formatNumber(sample.rpm)}`,
    lapLabel: `Tour ${sample.completed_laps + 1}`,
    lapTime: formatLapTime(sample.lap_time_ms),
    lastLap: formatLapTime(sample.last_lap_ms),
    position: `${percent}\u202f%`,
    positionPercent: percent,
  }
}
