import { createFileRoute, Link } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useLiveStore } from "@/stores/live-store"

export const Route = createFileRoute("/stations/$stationId/")({
  component: DirectPage,
})

function DirectPage() {
  const { stationId } = Route.useParams()
  const live = useLiveStore((state) => state.stations[stationId])

  return (
    <>
      <PageHeader
        eyebrow="Source : flux /stream"
        title={`Direct · ${stationId}`}
        description={live ? `${live.session.driver} · ${live.session.track}` : undefined}
        actions={
          <Button asChild variant="secondary">
            <Link to="/stations/$stationId/integrite" params={{ stationId }}>
              Voir l'intégrité
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Dernier échantillon</CardTitle>
          <CardDescription>
            Écran à construire : KPI, courbes, position sur la piste, tours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {live ? (
            <p className="text-metric-sm">
              {Math.round(live.latest.speed_kmh)}{" "}
              <span className="text-caption text-muted-foreground">
                km/h · rapport {live.latest.gear} ·{" "}
                {live.latest.rpm.toLocaleString("fr-FR")} tr/min
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Aucun échantillon reçu pour ce poste.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
