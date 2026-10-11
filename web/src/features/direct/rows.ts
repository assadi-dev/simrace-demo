import type { Sample } from "@/contracts/telemetry"
import {
  describeFlag,
  describePenalty,
  describeTrackFlag,
} from "@/features/direct/codes"
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

export type LapTable = {
  rows: LapRow[]
  /** Tours termines non affiches : invalides ou validite non lue. */
  hidden: number
}

/**
 * Tableau des tours : le tour en cours en tete (avec sa validite du moment), puis seulement les
 * tours termines valides selon ACC, du plus recent au plus ancien. Le meilleur se compare aux
 * tours valides uniquement.
 */
export function buildLapRows(
  sample: Sample,
  history: StationHistory
): LapTable {
  const valid = history.laps.filter((lap) => lap.valid === true)
  const times = valid.flatMap((lap) => (lap.timeMs ? [lap.timeMs] : []))
  const best = times.length > 0 ? Math.min(...times) : null

  const current: LapRow = {
    id: "current",
    label: `${sample.completed_laps + 1} (en cours)`,
    timeMs: sample.lap_time_ms || null,
    gap: null,
    validity: validity(sample.is_valid_lap),
  }
  const finished = valid.toReversed().map((lap): LapRow => ({
    id: `lap-${lap.number}`,
    label: String(lap.number),
    timeMs: lap.timeMs,
    gap:
      lap.timeMs == null || best == null
        ? null
        : lap.timeMs === best
          ? "best"
          : best - lap.timeMs,
    validity: "valid",
  }))
  return {
    rows: [current, ...finished],
    hidden: history.laps.length - valid.length,
  }
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
