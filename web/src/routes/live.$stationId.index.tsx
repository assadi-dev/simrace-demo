import type { CSSProperties } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { LayoutGridIcon, MaximizeIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { PhaseBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { WeatherChips } from "@/components/weather-chips"
import { MuteButton, ProtocolToggle } from "@/features/live/live-controls"
import {
  LiveVideo,
  OverlayChip,
  VideoStatusBadge,
} from "@/features/live/live-video"
import { StationThumb } from "@/features/live/station-thumb"
import { useLiveFeed } from "@/features/live/use-live-feed"
import { useTopOffset } from "@/features/live/use-top-offset"
import { liveStats, overlayTelemetry } from "@/features/live/values"
import { stationStatus } from "@/features/stations/status"
import { liveValues } from "@/features/stations/summary"
import { useNow } from "@/hooks/use-now"
import { formatAgo, NOT_AVAILABLE } from "@/lib/format"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/live/$stationId/")({
  component: LiveFocusPage,
})

const mosaicLink = (
  <Link
    to="/live"
    className="font-medium text-primary-text underline-offset-4 hover:underline"
  >
    Live
  </Link>
)

/*
 * Plafond du lecteur pour qu'il tienne en entier dans la fenetre : la video 16/9 prend la
 * hauteur visible (100svh, moins le haut du lecteur `--top-offset` et la marge basse de la page,
 * 6 unites), moins la hauteur fixe de la carte (21 unites + 2 px : padding 2 x 3, espace 3,
 * barre 12, bordures) ; en largeur, on y ajoute 6 unites + 2 px. Plancher de 80 unites pour
 * une fenetre tres basse.
 */
const PLAYER_VARS = {
  "--player-max":
    "max(var(--spacing) * 80, calc((100svh - var(--top-offset, 0px) - var(--spacing) * 27 - 2px) * 16 / 9 + var(--spacing) * 6 + 2px))",
} as CSSProperties

/**
 * Vue en grand d'un poste (maquette 6) : un seul lecteur actif, telemetrie du flux a droite,
 * autres postes en vignettes (changer de poste ferme le flux precedent).
 */
function LiveFocusPage() {
  const { stationId } = Route.useParams()
  const { feed, query } = useLiveFeed()
  const now = useNow()
  const playerRef = useTopOffset()
  const entry = feed.find((e) => e.station.station_id === stationId)

  if (!entry) {
    const [title, detail] = query.isPending
      ? ["Chargement des postes…", undefined]
      : query.isError
        ? ["Serveur injoignable", query.error.message]
        : [
            "Poste inconnu",
            `Aucun poste ${stationId} dans la liste. Revenez à la mosaïque pour en choisir un.`,
          ]
    return (
      <>
        <PageHeader
          breadcrumb={
            <>
              {mosaicLink} / {stationId}
            </>
          }
          title={stationId}
        />
        <Card className="px-6">
          <CardHeader className="px-0">
            <CardTitle>{title}</CardTitle>
            {detail ? <CardDescription>{detail}</CardDescription> : null}
          </CardHeader>
        </Card>
      </>
    )
  }

  const { station, live } = entry
  const status = stationStatus(station.online, live)
  const session = live?.session ?? station.session
  const seenAt = live?.receivedAt ?? station.last_seen?.getTime()
  const values = liveValues(status, live?.latest)
  const offline = status === "offline"

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            {mosaicLink} / {stationId}
          </>
        }
        title={`${session.driver} · ${stationId}`}
        badges={<PhaseBadge />}
        description={[
          session.track,
          session.car,
          station.machine ?? NOT_AVAILABLE,
        ].join(" · ")}
        actions={
          <>
            <ProtocolToggle />
            <Button asChild variant="secondary">
              <Link to="/live">
                <LayoutGridIcon aria-hidden="true" className="size-4.5" />
                Retour à la mosaïque
              </Link>
            </Button>
            <Button asChild>
              <Link to="/live/$stationId/plein-ecran" params={{ stationId }}>
                <MaximizeIcon aria-hidden="true" className="size-4.5" />
                Plein écran
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-start justify-center gap-5">
        {/* lecteur : 720 px de base, prend la place laissee par la telemetrie, plafonne des sm
            pour tenir en hauteur dans la fenetre (PLAYER_VARS) */}
        <Card
          ref={playerRef}
          style={PLAYER_VARS}
          className="min-w-0 flex-[999_1_720px] gap-3 p-3 sm:max-w-(--player-max)"
        >
          <LiveVideo
            // un lecteur par poste : changer de poste ferme le flux precedent
            key={stationId}
            stationId={stationId}
            status={status}
            size="focus"
          >
            <>
              <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                <VideoStatusBadge status={status} />
              </div>
              <OverlayChip className="absolute bottom-4 left-4 px-3.5 py-2 text-nav font-semibold">
                {overlayTelemetry(status, live?.latest)}
              </OverlayChip>
            </>
          </LiveVideo>
          {/* hauteur fixe (12 unites, bouton h-11 + pb-1) : le plafond du lecteur la compte */}
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <MuteButton className="px-4" />
            <span className="min-w-0 truncate text-meta text-muted-foreground">
              {seenAt ? `Vu ${formatAgo(now - seenAt)}` : "Jamais vu"} ·
              surimpressions issues du flux /stream
            </span>
          </div>
        </Card>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 sm:max-w-140">
          <Card size="sm" className="gap-2 px-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-card-title">Télémétrie</h2>
              <span className="text-eyebrow whitespace-nowrap text-primary-text">
                Flux /stream
              </span>
            </div>
            {liveStats(status, live?.latest, { withSpeed: true }).map(
              (stat) => (
                <div
                  key={stat.label}
                  className="flex items-baseline justify-between gap-3 rounded-md border border-card-border bg-card-inner px-3.5 py-2.5 whitespace-nowrap"
                >
                  <span className="text-label text-muted-foreground">
                    {stat.label}
                  </span>
                  <span
                    className={cn(
                      "text-metric-sm",
                      stat.muted && "text-muted-foreground"
                    )}
                  >
                    {stat.value}
                  </span>
                </div>
              )
            )}
            <div className="flex flex-col gap-1.5 px-1 pt-1.5">
              <div className="flex justify-between text-meta text-muted-foreground">
                <span>Position sur le tour</span>
                <span>{values.position}</span>
              </div>
              <Progress
                value={values.positionPercent}
                aria-label="Position sur le tour"
              />
            </div>
          </Card>

          <WeatherChips
            air={offline ? undefined : live?.latest.air_temp_c}
            road={offline ? undefined : live?.latest.road_temp_c}
          />

          <Button asChild variant="secondary">
            <Link to="/stations/$stationId" params={{ stationId }}>
              Ouvrir le direct du poste
            </Link>
          </Button>
        </div>
      </div>

      <Card className="gap-3 p-4">
        <h2 className="px-1 text-card-title">Autres postes</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
          {feed.map((e) => (
            <StationThumb
              key={e.station.station_id}
              entry={e}
              selected={e.station.station_id === stationId}
              tone="light"
            />
          ))}
        </div>
      </Card>
    </>
  )
}
