import type { SessionInfo } from "@/contracts/telemetry"
import { NOT_AVAILABLE } from "@/lib/format"

/** Noms des jeux envoyes par l'agent (session.game, decision 0022). */
const GAME_NAME: Record<string, string> = {
  acc: "ACC",
  acevo: "AC EVO",
}

/** "AC EVO 0.9.1" ; un jeu inconnu garde son identifiant ; sans jeu (ancien agent) : n.d. */
export function gameLabel(
  session: Pick<SessionInfo, "game" | "game_version">
): string {
  if (!session.game) return `Jeu ${NOT_AVAILABLE}`
  const name = GAME_NAME[session.game] ?? session.game
  return session.game_version ? `${name} ${session.game_version}` : name
}
