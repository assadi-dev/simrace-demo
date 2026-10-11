import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { stationsQueryOptions } from "@/features/stations/queries"
import { stationStatus } from "@/features/stations/status"
import { useLiveStore } from "@/stores/live-store"

export const Route = createFileRoute("/")({
  component: StationsPage,
})

function StationsPage() {
  const stations = useQuery(stationsQueryOptions)
  const live = useLiveStore((state) => state.stations)

  return (
    <>
      <PageHeader
        eyebrow="Source : GET /stations toutes les 2 s"
        title="Postes"
        description={
          stations.data
            ? `${stations.data.length} postes déclarés, ${stations.data.filter((s) => s.online).length} en ligne`
            : undefined
        }
      />

      {stations.isPending ? (
        <p className="text-muted-foreground">Chargement des postes…</p>
      ) : stations.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Serveur injoignable</CardTitle>
            <CardDescription>{stations.error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : stations.data.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucun poste déclaré</CardTitle>
            <CardDescription>
              Un poste apparaît dès que l'agent envoie son premier lot.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {stations.data.map((station) => (
            <Card key={station.station_id}>
              <CardHeader>
                <CardTitle>{station.station_id}</CardTitle>
                <CardDescription>{station.machine ?? "PC inconnu"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <StatusBadge
                    status={stationStatus(
                      station.online,
                      live[station.station_id]
                    )}
                  />
                </div>
                <p className="text-sm font-medium">
                  {station.session.track} · {station.session.car}
                </p>
                <p className="text-caption text-muted-foreground">
                  {station.session.driver}
                </p>
              </CardContent>
              <CardFooter className="flex-wrap gap-2">
                <Button asChild>
                  <Link
                    to="/stations/$stationId"
                    params={{ stationId: station.station_id }}
                  >
                    Ouvrir le direct
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link
                    to="/stations/$stationId/integrite"
                    params={{ stationId: station.station_id }}
                  >
                    Voir l'intégrité
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
