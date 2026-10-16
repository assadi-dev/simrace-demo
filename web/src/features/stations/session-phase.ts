import { NOT_AVAILABLE } from "@/lib/format"

/**
 * Phases ecrites par AC EVO (session_state.phase_name, decision 0022), vues en essais et en course
 * le 2026-10-16. ACC n'en donne pas.
 */
const PHASE_LABEL: Record<string, string> = {
  Waiting_For_Start: "En attente du départ",
  Start_Spawn_On_Position: "Mise en place sur la grille",
  Start_Countdown_No_Lights: "Compte à rebours",
  Start_Countdown_Lights_On: "Feux allumés",
  Start_Countdown_Lights_Off: "Feux éteints, départ",
  Session: "En cours",
  Ended: "Terminée",
}

/** Libelle de la phase. Une phase inconnue s'affiche telle que le jeu l'ecrit, jamais perdue. */
export function sessionPhaseLabel(phase: string | null | undefined): string {
  if (!phase) return NOT_AVAILABLE
  return PHASE_LABEL[phase] ?? phase.replaceAll("_", " ")
}

/** Session finie : EVO arrete alors le chrono du tour, meme si la voiture roule encore. */
export const isSessionEnded = (phase: string | null | undefined) =>
  phase === "Ended"
