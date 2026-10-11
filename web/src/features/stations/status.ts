import { ACC_STATUS } from "@/contracts/telemetry"
import type { LiveStation } from "@/stores/live-store"

export type StationStatus = "online" | "paused" | "offline"

/**
 * `online` vient de GET /stations (fenetre de 5 s cote serveur) ; la pause vient du dernier
 * echantillon du flux. Un poste hors ligne n'est jamais affiche en pause.
 */
export function stationStatus(
  online: boolean,
  live: LiveStation | undefined
): StationStatus {
  if (!online) return "offline"
  return live?.latest.status === ACC_STATUS.pause ? "paused" : "online"
}
