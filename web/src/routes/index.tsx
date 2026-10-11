import { useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { stationsQueryOptions } from "@/features/stations/queries"
import { StationCard } from "@/features/stations/station-card"
import { sortStations, summarizeStations } from "@/features/stations/summary"
import { useNow } from "@/hooks/use-now"
import { config } from "@/lib/config"
import { formatNumber } from "@/lib/format"
import { useLiveStore } from "@/stores/live-store"

export const Route = createFileRoute("/")({
  component: StationsPage,
})

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? "s" : ""}`

function StationsPage() {
  const stations = useQuery(stationsQueryOptions)
  const live = useLiveStore((state) => state.stations)
  const now = useNow()

  const sorted = useMemo(
    () => (stations.data ? sortStations(stations.data) : []),
    [stations.data]
  )
  const summary = useMemo(() => summarizeStations(sorted), [sorted])

  return (
    <>
      <PageHeader
        title="Postes"
        eyebrow="Source : GET /stations toutes les 2 s"
        description={
          stations.data
            ? `${plural(summary.total, "poste")} ${summary.total > 1 ? "déclarés" : "déclaré"}, ${summary.online} en ligne`
            : undefined
        }
      />

      {stations.isPending ? (
        <p className="px-1 text-muted-foreground">Chargement des postes…</p>
      ) : stations.isError ? (
        <Card className="px-6">
          <CardHeader className="px-0">
            <CardTitle>Serveur injoignable</CardTitle>
            <CardDescription>{stations.error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-5">
            <KpiCard
              className="flex-[1_1_200px]"
              label="Postes en ligne"
              value={`${summary.online} / ${config.maxStations}`}
              help={
                summary.total > config.maxStations
                  ? `${summary.total} postes déclarés, plus que le maximum (${config.maxStations})`
                  : "Muet depuis plus de 5 s = hors ligne"
              }
            />
            <KpiCard
              className="flex-[1_1_200px]"
              label="Échantillons acceptés"
              value={formatNumber(summary.samples)}
              help="Après validation des bornes"
            />
            <KpiCard
              className="flex-[1_1_200px]"
              label="Lots en doublon"
              value={formatNumber(summary.duplicates)}
              help="Ignorés, jamais comptés deux fois"
            />
            <KpiCard
              className="flex-[1_1_200px]"
              label="Trous constatés"
              value={formatNumber(summary.gaps)}
              help="Numéros de lot manquants"
            />
            <KpiCard
              className="flex-[1_1_200px]"
              label="Échantillons rejetés"
              value={formatNumber(summary.rejected)}
              help="Comptés avec leur raison"
            />
          </div>

          {sorted.length === 0 ? (
            <Card className="px-6">
              <CardHeader className="px-0">
                <CardTitle>Aucun poste déclaré</CardTitle>
                <CardDescription>
                  Un poste apparaît dès que l'agent envoie son premier lot.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            // grille plutot que flex : une carte seule sur sa ligne ne s'etire pas
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(420px,100%),1fr))] gap-5">
              {sorted.map((station) => (
                <StationCard
                  key={station.station_id}
                  station={station}
                  live={live[station.station_id]}
                  now={now}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
