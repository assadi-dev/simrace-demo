import { Badge } from "@/components/ui/badge"
import {
  isSessionEnded,
  sessionPhaseLabel,
} from "@/features/stations/session-phase"

/** Phase de la session (AC EVO, decision 0022) : "Session terminée" ressort en avertissement. */
export function SessionPhaseBadge({
  phase,
}: {
  phase: string | null | undefined
}) {
  return (
    <Badge variant={isSessionEnded(phase) ? "warning" : "info"}>
      Session : {sessionPhaseLabel(phase)}
    </Badge>
  )
}
