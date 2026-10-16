import type { Sample } from "@/contracts/telemetry"
import {
  describeFlag,
  describePenalty,
  describeTrackFlag,
} from "@/features/direct/codes"
import type { ActiveEvent, StationHistory } from "@/features/direct/history"
import { isSessionEnded } from "@/features/stations/session-phase"

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

/** Tours termines non listes, par raison (pour verifier la validite sur un vrai jeu). */
export type HiddenLaps = {
  /** is_valid_lap a faux pendant le tour. */
  accFlag: number
  /** Plus rapide que le meilleur temps d'ACC, qui ne l'a donc pas retenu. */
  fasterThanAccBest: number
  /** L'agent n'envoie pas is_valid_lap. */
  unknown: number
  /** Controle par le meilleur temps d'ACC encore en cours (2 s apres la ligne). */
  pending: number
}

export type LapTable = {
  rows: LapRow[]
  hidden: HiddenLaps
}

/**
 * Tableau des tours : le tour en cours en tete (avec sa validite du moment), puis seulement les
 * tours termines valides et controles (laps.ts), du plus recent au plus ancien. Le meilleur se
 * compare a ces tours uniquement.
 */
export function buildLapRows(
  sample: Sample,
  history: StationHistory
): LapTable {
  const valid = history.laps.filter(
    (lap) => lap.valid === true && lap.bestCheckUntil === null
  )
  const hidden: HiddenLaps = {
    accFlag: 0,
    fasterThanAccBest: 0,
    unknown: 0,
    pending: 0,
  }
  for (const lap of history.laps) {
    if (lap.invalidReason === "acc_flag") hidden.accFlag += 1
    else if (lap.invalidReason === "faster_than_acc_best")
      hidden.fasterThanAccBest += 1
    else if (lap.valid === null) hidden.unknown += 1
    else if (lap.bestCheckUntil !== null) hidden.pending += 1
  }
  const times = valid.flatMap((lap) => (lap.timeMs ? [lap.timeMs] : []))
  const best = times.length > 0 ? Math.min(...times) : null

  const current: LapRow = {
    id: "current",
    // AC EVO dit quand la session est finie (session_phase) ; sans la valeur (ACC), "en cours"
    label: `${sample.completed_laps + 1} (${isSessionEnded(sample.session_phase) ? "terminée" : "en cours"})`,
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
  return { rows: [current, ...finished], hidden }
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
