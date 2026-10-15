import { NOT_AVAILABLE } from "@/lib/format"

/** Phases ecrites par AC EVO (session_state.phase_name, decision 0022). ACC n'en donne pas. */
const PHASE_LABEL: Record<string, string> = {
  Waiting_For_Start: "En attente du départ",
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
