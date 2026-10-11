import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { StationStatus } from "@/features/stations/status"

/*
 * Un statut ne se lit jamais a la couleur seule (design.md 1.5) : libelle + pastille dont la
 * forme change (rond plein, carre arrondi, anneau), pour qu'un daltonien les distingue.
 */
const STATUS = {
  online: {
    label: "En ligne",
    variant: "success",
    dot: "rounded-full bg-success",
  },
  paused: {
    label: "En pause",
    variant: "warning",
    dot: "rounded-[2px] bg-warning",
  },
  offline: {
    label: "Hors ligne",
    variant: "danger",
    dot: "rounded-full border-2 border-danger",
  },
} as const

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StationStatus
  /** Remplace le libelle par defaut (ex. "Flux en direct connecte"). */
  label?: string
  className?: string
}) {
  const config = STATUS[status]
  return (
    <Badge variant={config.variant} className={className}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0", config.dot)}
      />
      {label ?? config.label}
    </Badge>
  )
}

/** Fonctionnalite pas encore livree : "Phase 2", sans pastille (design.md 8). */
export function PhaseBadge({ className }: { className?: string }) {
  return (
    <Badge variant="info" className={className}>
      Phase 2
    </Badge>
  )
}
