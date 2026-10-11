import type { Station } from "@/contracts/stations"
import type { LiveStation } from "@/stores/live-store"
import { stationStatus, type StationStatus } from "@/features/stations/status"

/** Une ligne du leaderboard : un poste (donc un pilote) croise avec son dernier echantillon. */
export type DriverRow = {
  stationId: string
  machine: string | null
  driver: string
  car: string
  track: string
  status: StationStatus
  /** Position au sein du meme circuit : tours completes, puis `track_pos`. */
  rank: number
  /** Numero du tour en cours ; `null` tant qu'aucun echantillon du flux n'est arrive. */
  lap: number | null
  /** Les temps valent `null` quand l'agent envoie 0 (inconnu) ou qu'il n'y a pas de direct. */
  lapTimeMs: number | null
  lastLapMs: number | null
  bestLapMs: number | null
  completedLaps: number | null
  trackPos: number | null
}

const knownMs = (value: number | undefined) => (value ? value : null)

/**
 * Croise GET /stations (pilote, voiture, circuit, statut) avec le dernier echantillon du flux
 * (tour, temps, position). Le classement est calcule par circuit.
 */
export function buildDriverRows(
  stations: readonly Station[],
  live: Readonly<Record<string, LiveStation>>
): DriverRow[] {
  const rows = stations.map((station): Omit<DriverRow, "rank"> => {
    const liveStation = live[station.station_id]
    const sample = liveStation?.latest
    return {
      stationId: station.station_id,
      machine: station.machine,
      driver: station.session.driver,
      car: station.session.car,
      track: station.session.track,
      status: stationStatus(station.online, liveStation),
      lap: sample ? sample.completed_laps + 1 : null,
      lapTimeMs: knownMs(sample?.lap_time_ms),
      lastLapMs: knownMs(sample?.last_lap_ms),
      bestLapMs: knownMs(sample?.best_lap_ms),
      completedLaps: sample?.completed_laps ?? null,
      trackPos: sample?.track_pos ?? null,
    }
  })

  const rankByStation = new Map<string, number>()
  const byTrack = new Map<string, Omit<DriverRow, "rank">[]>()
  for (const row of rows) {
    byTrack.set(row.track, [...(byTrack.get(row.track) ?? []), row])
  }
  for (const group of byTrack.values()) {
    const ordered = [...group].sort(
      (a, b) =>
        (b.completedLaps ?? -1) - (a.completedLaps ?? -1) ||
        (b.trackPos ?? -1) - (a.trackPos ?? -1) ||
        a.stationId.localeCompare(b.stationId)
    )
    ordered.forEach((row, index) => rankByStation.set(row.stationId, index + 1))
  }

  return rows.map((row) => ({
    ...row,
    rank: rankByStation.get(row.stationId) ?? 0,
  }))
}

/** Circuits presents, dans l'ordre alphabetique, avec le nombre de pilotes. */
export function listTracks(rows: readonly DriverRow[]) {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.track, (counts.get(row.track) ?? 0) + 1)
  return [...counts]
    .map(([track, count]) => ({ track, count }))
    .sort((a, b) => a.track.localeCompare(b.track))
}
