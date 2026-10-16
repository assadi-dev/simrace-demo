import type { TrackFlag } from "@/contracts/telemetry"

/*
 * Noms lisibles des codes d'ACC, repris de agent/src/simrace_agent/codes.py.
 * Jamais vus sur un vrai jeu (decision 0016) : un code absent de la table s'affiche avec son
 * numero ("Penalite (code 42)"), on n'invente pas de raison.
 */

const FLAGS: Record<number, string> = {
  1: "Drapeau bleu",
  2: "Drapeau jaune",
  3: "Drapeau noir",
  4: "Drapeau blanc",
  5: "Drapeau à damier",
  6: "Drapeau de pénalité",
  // codes ACC qui servent aussi a traduire le vert et l'orange d'AC EVO (decision 0022)
  7: "Drapeau vert",
  8: "Drapeau orange (problème mécanique)",
}

const PENALTIES: Record<number, string> = {
  1: "Drive-through (coupure de piste)",
  2: "Stop and go 10 s (coupure de piste)",
  3: "Stop and go 20 s (coupure de piste)",
  4: "Stop and go 30 s (coupure de piste)",
  5: "Disqualification (coupure de piste)",
  6: "Meilleur tour supprimé (coupure de piste)",
  7: "Drive-through (excès de vitesse aux stands)",
  8: "Stop and go 10 s (excès de vitesse aux stands)",
  9: "Stop and go 20 s (excès de vitesse aux stands)",
  10: "Stop and go 30 s (excès de vitesse aux stands)",
  11: "Disqualification (excès de vitesse aux stands)",
  12: "Meilleur tour supprimé (excès de vitesse aux stands)",
  13: "Disqualification (arrêt obligatoire ignoré)",
  14: "Temps ajouté après la course",
  15: "Disqualification (comportement)",
  16: "Disqualification (entrée des stands interdite)",
  17: "Disqualification (sortie des stands interdite)",
  18: "Disqualification (mauvais sens)",
  19: "Drive-through (relais de pilote ignoré)",
  20: "Disqualification (relais de pilote ignoré)",
  21: "Disqualification (durée maximale de relais dépassée)",
}

const TRACK_FLAG_LABELS: Record<TrackFlag, string> = {
  yellow: "Drapeau jaune",
  yellow_s1: "Drapeau jaune secteur 1",
  yellow_s2: "Drapeau jaune secteur 2",
  yellow_s3: "Drapeau jaune secteur 3",
  white: "Drapeau blanc",
  green: "Drapeau vert",
  chequered: "Drapeau à damier",
  red: "Drapeau rouge",
}

export const describeFlag = (code: number) =>
  FLAGS[code] ?? `Drapeau (code ${code})`

export const describePenalty = (code: number) =>
  PENALTIES[code] ?? `Pénalité (code ${code})`

export const describeTrackFlag = (flag: TrackFlag) => TRACK_FLAG_LABELS[flag]
