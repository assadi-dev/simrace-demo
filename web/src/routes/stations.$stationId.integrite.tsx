import { createFileRoute, Link } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/stations/$stationId/integrite")({
  component: IntegrityPage,
})

function IntegrityPage() {
  const { stationId } = Route.useParams()

  return (
    <>
      <PageHeader
        eyebrow="Source : GET /stations"
        title={`Intégrité · ${stationId}`}
        actions={
          <Button asChild variant="secondary">
            <Link to="/stations/$stationId" params={{ stationId }}>
              Ouvrir le direct
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Compteurs et raisons de rejet</CardTitle>
          <CardDescription>
            Écran à construire : lots, doublons, trous, rejets comptés avec leur raison.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  )
}
