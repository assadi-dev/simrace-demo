import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { STATUS_LABEL, type StationStatus } from "@/features/stations/status"

/*
 * Un statut ne se lit jamais a la couleur seule (design.md 1.5) : libelle + pastille dont la
 * forme change (rond plein, carre arrondi, anneau), pour qu'un daltonien les distingue.
 */
const STATUS = {
  online: { variant: "success", dot: "rounded-full bg-success" },
  paused: { variant: "warning", dot: "rounded-[2px] bg-warning" },
  offline: { variant: "danger", dot: "rounded-full border-2 border-danger" },
} as const

/** Pastille seule, quand le libelle est ecrit a cote (vignettes du plein ecran). */
export function StatusDot({
  status,
  className,
}: {
  status: StationStatus
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2 shrink-0", STATUS[status].dot, className)}
    />
  )
}

export function StatusBadge({
  status,
  label,
  className,
  labelClassName,
}: {
  status: StationStatus
  /** Remplace le libelle par defaut (ex. "Flux en direct connecte"). */
  label?: string
  className?: string
  /** Ex. `sr-only` : pastille seule a l'ecran, libelle toujours lu par un lecteur d'ecran. */
  labelClassName?: string
}) {
  return (
    <Badge variant={STATUS[status].variant} className={className}>
      <StatusDot status={status} />
      <span className={labelClassName}>{label ?? STATUS_LABEL[status]}</span>
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
