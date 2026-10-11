import { useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useQueryState } from "nuqs"

import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { driverColumns } from "@/features/leaderboard/columns"
import { buildDriverRows, listTracks } from "@/features/leaderboard/rows"
import { stationsQueryOptions } from "@/features/stations/queries"
import { useLiveStore } from "@/stores/live-store"

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
})

function LeaderboardPage() {
  const stations = useQuery(stationsQueryOptions)
  const live = useLiveStore((state) => state.stations)
  // Le circuit choisi vit dans l'URL (?circuit=...) : le lien partage la meme vue.
  const [circuit, setCircuit] = useQueryState("circuit")

  const rows = useMemo(
    () => (stations.data ? buildDriverRows(stations.data, live) : []),
    [stations.data, live]
  )
  const tracks = useMemo(() => listTracks(rows), [rows])
  const selected = tracks.some((t) => t.track === circuit)
    ? circuit
    : (tracks[0]?.track ?? null)
  const visibleRows = useMemo(
    () => rows.filter((row) => row.track === selected),
    [rows, selected]
  )

  return (
    <>
      <PageHeader
        eyebrow="Source : GET /stations + flux /stream"
        title="Leaderboard"
        description="Pilotes regroupés par circuit. Pos. = tours complétés, puis position sur le tour."
      />

      {stations.isPending ? (
        <p className="text-muted-foreground">Chargement des pilotes…</p>
      ) : stations.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Serveur injoignable</CardTitle>
            <CardDescription>{stations.error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {tracks.length > 1 ? (
            <ToggleGroup
              type="single"
              aria-label="Circuit"
              className="max-w-full flex-wrap"
              value={selected ?? ""}
              onValueChange={(value) => value && void setCircuit(value)}
            >
              {tracks.map(({ track, count }) => (
                <ToggleGroupItem
                  key={track}
                  value={track}
                  title={track}
                  className="max-w-full min-w-0"
                >
                  <span className="truncate">{track}</span>
                  <span className="text-micro">{count}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          <DataTable
            columns={driverColumns}
            data={visibleRows}
            getRowId={(row) => row.stationId}
            initialSorting={[{ id: "rank", desc: false }]}
            emptyMessage="Aucun pilote : un poste apparaît dès que l'agent envoie son premier lot."
          />
        </>
      )}
    </>
  )
}
