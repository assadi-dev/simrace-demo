import { Link } from "@tanstack/react-router"
import { ArrowUpRightIcon, MaximizeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  LiveVideo,
  OverlayChip,
  LiveStatusBadge,
} from "@/features/live/live-video"
import type { LiveFeedEntry } from "@/features/live/use-live-feed"
import { overlayTelemetry } from "@/features/live/values"
import { stationStatus } from "@/features/stations/status"
import { formatAgo, NOT_AVAILABLE } from "@/lib/format"

/**
 * Tuile de la mosaique (maquette 5) : apercu 16/9 (premiere image du flux) avec pilote, statut,
 * telemetrie et protocole en surimpression, puis circuit, voiture et actions (icones).
 */
export function LiveTile({
  entry,
  now,
}: {
  entry: LiveFeedEntry
  now: number
}) {
  const { station, live } = entry
  const status = stationStatus(station.online, live)
  const session = live?.session ?? station.session
  const seenAt = live?.receivedAt ?? station.last_seen?.getTime()
  const stationId = station.station_id

  return (
    <Card className="min-w-0 gap-3 p-3">
      <LiveVideo stationId={stationId} status={status} size="tile" preview>
        {({ badge }) => (
          <>
            <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              <span className="flex min-w-0 flex-col rounded-cell bg-sand-950/70 px-3 py-1.5 text-white">
                <span className="truncate text-sm leading-5 font-semibold">
                  {session.driver}
                </span>
                <span className="truncate text-xs text-white/70">
                  {stationId} · {station.machine ?? NOT_AVAILABLE}
                </span>
              </span>
              <LiveStatusBadge status={badge} />
            </div>
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
              <OverlayChip className="px-3 py-1.5 text-label font-semibold">
                {overlayTelemetry(status, live?.latest)}
              </OverlayChip>
            </div>
          </>
        )}
      </LiveVideo>

      {/* hauteur fixe (12 unites, bouton h-11 + pb-1) : la mosaique calcule la taille des tuiles avec */}
      <div className="flex items-center justify-between gap-3 px-1 pb-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {session.track} · {session.car}
          </span>
          <span className="text-meta text-muted-foreground">
            {seenAt ? `Vu ${formatAgo(now - seenAt)}` : "Jamais vu"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button asChild size="icon">
            <Link
              to="/live/$stationId"
              params={{ stationId }}
              search
              aria-label={`Voir en grand ${stationId}`}
              title="Voir en grand"
            >
              <ArrowUpRightIcon aria-hidden="true" className="size-4.5" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="icon">
            <Link
              to="/live/$stationId/plein-ecran"
              params={{ stationId }}
              search
              aria-label={`Plein écran ${stationId}`}
              title="Plein écran"
            >
              <MaximizeIcon aria-hidden="true" className="size-4.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
