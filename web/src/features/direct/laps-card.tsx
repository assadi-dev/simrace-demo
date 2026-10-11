import { useMemo } from "react"

import { createDataTableColumns, DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { Sample } from "@/contracts/telemetry"
import type { StationHistory } from "@/features/direct/history"
import {
  buildLapRows,
  type LapRow,
  type Validity,
} from "@/features/direct/rows"
import { cn } from "@/lib/utils"
import { formatDelta, formatLapTime, NOT_AVAILABLE } from "@/lib/format"

const VALIDITY = {
  valid: { label: "Valide", variant: "success" },
  invalid: { label: "Invalide", variant: "danger" },
  unknown: { label: "Non lue", variant: "warning" },
} as const satisfies Record<Validity, { label: string; variant: string }>

const column = createDataTableColumns<LapRow>()

// L'ordre (tour en cours, puis du plus recent au plus ancien) est celui de la course : pas de tri.
const lapColumns = column.columns([
  column.accessor("label", {
    header: "Tour",
    enableSorting: false,
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  column.accessor("timeMs", {
    header: "Temps",
    enableSorting: false,
    cell: (info) => formatLapTime(info.getValue()),
  }),
  column.accessor("gap", {
    header: "Écart",
    enableSorting: false,
    cell: (info) => {
      const gap = info.getValue()
      if (gap === "best") return <span className="font-semibold">Meilleur</span>
      if (gap === null) return NOT_AVAILABLE
      return (
        <span
          className={cn(
            "font-semibold",
            gap < 0 ? "text-delta-slower" : "text-delta-equal"
          )}
        >
          {formatDelta(gap)}
        </span>
      )
    },
  }),
  column.accessor("validity", {
    header: "Validité",
    enableSorting: false,
    cell: (info) => {
      const { label, variant } = VALIDITY[info.getValue()]
      return (
        <Badge variant={variant} className="px-2.5 py-0.5">
          {label}
        </Badge>
      )
    },
  }),
])

/** Tours valides deduits de completed_laps (maquette 2), vus depuis l'ouverture de la page. */
export function LapsCard({
  sample,
  history,
}: {
  sample: Sample
  history: StationHistory
}) {
  const { rows, hidden } = useMemo(
    () => buildLapRows(sample, history),
    [sample, history]
  )
  return (
    <Card className="px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-card-title">Tours</h2>
        <span className="text-eyebrow text-primary-text">
          Déduit de completed_laps
        </span>
      </div>
      <DataTable columns={lapColumns} data={rows} getRowId={(row) => row.id} />
      <p className="text-meta text-muted-foreground">
        Seuls les tours valides selon ACC (is_valid_lap) sont listés, depuis
        l'ouverture de la page. Masqués (invalides ou non lus) : {hidden}.
      </p>
    </Card>
  )
}
