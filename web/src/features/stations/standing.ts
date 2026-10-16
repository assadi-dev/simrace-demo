import type { Sample } from "@/contracts/telemetry"
import { NOT_AVAILABLE } from "@/lib/format"

type Standing = Pick<Sample, "race_position" | "opponents">

/** Place au classement (decision 0023) : "P7", n.d. si le jeu ne la donne pas. */
export function racePositionLabel(sample: Standing): string {
  return sample.race_position == null ? NOT_AVAILABLE : `P${sample.race_position}`
}

/** Adversaires en piste : 0 si le joueur est seul, n.d. si le jeu ne les donne pas. */
export function opponentsLabel(sample: Standing): string {
  return sample.opponents == null ? NOT_AVAILABLE : String(sample.opponents)
}

/** Detail sous la place : nombre de voitures, ou pourquoi il n'y a pas de place. */
export function racePositionHelp(sample: Standing): string {
  if (sample.race_position == null) {
    return sample.opponents === 0
      ? "Pas de classement, seul en piste"
      : "Non donnée par le jeu"
  }
  return sample.opponents == null
    ? "Classement du jeu"
    : `Sur ${sample.opponents + 1} voitures`
}
