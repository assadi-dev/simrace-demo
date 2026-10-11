import type { Sample } from "@/contracts/telemetry"
import { describeFlag, describePenalty, describeTrackFlag } from "@/features/direct/codes"
import type { ActiveEvent, StationHistory } from "@/features/direct/history"

export type Validity = "valid" | "invalid" | "unknown"

export type LapRow = {
  id: string
  label: string
  timeMs: number | null
  /** "best" = meilleur tour vu ; sinon ecart en ms (negatif = plus lent), null si inconnu. */
  gap: "best" | number | null
  validity: Validity
}

const validity = (valid: boolean | null | undefined): Validity =>
  valid == null ? "unknown" : valid ? "valid" : "invalid"

/** Tableau des tours : le tour en cours en tete, puis les tours termines du plus recent au plus ancien. */
export function buildLapRows(sample: Sample, history: StationHistory): LapRow[] {
  const times = history.laps.flatMap((lap) => (lap.timeMs ? [lap.timeMs] : []))
  const best = times.length > 0 ? Math.min(...times) : null

  const current: LapRow = {
    id: "current",
    label: `${sample.completed_laps + 1} (en cours)`,
    timeMs: sample.lap_time_ms || null,
    gap: null,
    validity: validity(sample.is_valid_lap),
  }
  const finished = history.laps.toReversed().map(
    (lap): LapRow => ({
      id: `lap-${lap.number}`,
      label: String(lap.number),
      timeMs: lap.timeMs,
      gap:
        lap.timeMs == null || best == null
          ? null
          : lap.timeMs === best
            ? "best"
            : best - lap.timeMs,
      validity: validity(lap.valid),
    })
  )
  return [current, ...finished]
}

/** Nom lisible d'un drapeau ou d'une penalite (code inconnu : son numero, jamais une raison inventee). */
export function describeEvent(event: ActiveEvent): string {
  switch (event.kind) {
    case "penalty":
      return describePenalty(event.code)
    case "flag":
      return describeFlag(event.code)
    case "track_flag":
      return describeTrackFlag(event.code)
  }
}

/** Jaune (personnel, global ou de secteur) : pastille `flag-yellow` en plus du libelle. */
export const isYellowEvent = (event: ActiveEvent) =>
  (event.kind === "flag" && event.code === 2) ||
  (event.kind === "track_flag" && event.code.startsWith("yellow"))
