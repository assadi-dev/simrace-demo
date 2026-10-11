import { Link } from "@tanstack/react-router"

import { createDataTableColumns } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import type { DriverRow } from "@/features/leaderboard/rows"
import { formatLapTime, NOT_AVAILABLE } from "@/lib/format"

const column = createDataTableColumns<DriverRow>()

export const driverColumns = column.columns([
  column.accessor("rank", {
    header: "Pos.",
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  column.accessor("driver", {
    header: "Pilote",
    cell: (info) => {
      const { stationId, machine } = info.row.original
      return (
        <div className="flex flex-col">
          <Link
            to="/stations/$stationId"
            params={{ stationId }}
            className="font-medium text-primary-text underline-offset-4 hover:underline"
          >
            {info.getValue() || NOT_AVAILABLE}
          </Link>
          <span className="text-meta text-muted-foreground">
            {machine ? `${stationId} · ${machine}` : stationId}
          </span>
        </div>
      )
    },
  }),
  column.accessor("car", { header: "Voiture" }),
  column.accessor("status", {
    header: "Statut",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  column.accessor((row) => row.lap ?? undefined, {
    id: "lap",
    header: "Tour",
    sortUndefined: "last",
    cell: (info) => info.getValue() ?? NOT_AVAILABLE,
  }),
  // Temps : le plus rapide d'abord ; un temps inconnu (undefined) reste en dernier dans les deux sens (sortUndefined).
  column.accessor((row) => row.lapTimeMs ?? undefined, {
    id: "lapTimeMs",
    header: "Temps actuel",
    sortDescFirst: false,
    sortUndefined: "last",
    cell: (info) => formatLapTime(info.getValue()),
  }),
  column.accessor((row) => row.lastLapMs ?? undefined, {
    id: "lastLapMs",
    header: "Tour précédent",
    sortDescFirst: false,
    sortUndefined: "last",
    cell: (info) => formatLapTime(info.getValue()),
  }),
  column.accessor((row) => row.bestLapMs ?? undefined, {
    id: "bestLapMs",
    header: "Meilleur tour",
    sortDescFirst: false,
    sortUndefined: "last",
    cell: (info) => (
      <span className="font-semibold">{formatLapTime(info.getValue())}</span>
    ),
  }),
])
