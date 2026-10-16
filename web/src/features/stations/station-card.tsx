import { Link } from "@tanstack/react-router"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { WeatherChips } from "@/components/weather-chips"
import { Progress } from "@/components/ui/progress"
import type { Station } from "@/contracts/stations"
import { gameLabel } from "@/features/stations/game"
import { stationStatus } from "@/features/stations/status"
import { liveValues } from "@/features/stations/summary"
import { formatAgo, formatNumber, NOT_AVAILABLE } from "@/lib/format"
import type { LiveStation } from "@/stores/live-store"

/**
 * Carte d'un poste (maquette 1. Postes). Session et compteurs viennent de GET /stations,
 * les valeurs en direct du dernier echantillon du flux.
 */
export function StationCard({
  station,
  live,
  now,
}: {
  station: Station
  live: LiveStation | undefined
  now: number
}) {
  const status = stationStatus(station.online, live)
  const values = liveValues(status, live?.latest)
  // l'horloge du navigateur d'abord : last_seen vient de l'horloge du serveur, parfois decalee
  const seenAt = live?.receivedAt ?? station.last_seen?.getTime()

  const metrics = [
    ["Vitesse", values.speed],
    ["Rapport · tr/min", values.gearRpm],
    [values.lapLabel, values.lapTime],
    ["Dernier tour", values.lastLap],
    ["Meilleur tour ACC", values.bestLap],
    ["Session", values.sessionPhase],
    ["Position", values.racePosition],
    ["Adversaires", values.opponents],
  ]
  const counters = [
    ["Lots", station.batches],
    ["Doublons", station.duplicates],
    ["Trous", station.gaps],
    ["Rejets", station.rejected],
  ] as const

  return (
    <Card className="min-w-0 gap-4 px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-card-title">{station.station_id}</h2>
          <span className="truncate text-meta text-muted-foreground">
            {station.machine ?? NOT_AVAILABLE}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">
          {station.session.track} · {station.session.car}
        </span>
        <span className="text-caption text-muted-foreground">
          {station.session.driver} · {gameLabel(station.session)} ·{" "}
          {seenAt ? `vu ${formatAgo(now - seenAt)}` : "jamais vu"}
        </span>
      </div>

      <dl className="flex flex-wrap gap-x-7 gap-y-4">
        {metrics.map(([label, value], index) => (
          <div key={index} className="flex flex-col gap-0.5">
            <dt className="text-caption text-muted-foreground">{label}</dt>
            <dd className="text-metric-sm whitespace-nowrap">{value}</dd>
          </div>
        ))}
      </dl>

      {/* meteo du dernier echantillon ; hors ligne, n.d. comme les autres valeurs en direct */}
      <WeatherChips
        compact
        air={status === "offline" ? undefined : live?.latest.air_temp_c}
        road={status === "offline" ? undefined : live?.latest.road_temp_c}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-meta text-muted-foreground">
          <span>Position sur le tour</span>
          <span>{values.position}</span>
        </div>
        <Progress
          value={values.positionPercent}
          aria-label="Position sur le tour"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {counters.map(([label, value]) => (
          <span
            key={label}
            className="inline-flex gap-1.5 rounded-full bg-card-strong px-2.5 py-1 text-xs"
          >
            <span className="text-muted-foreground">{label}</span>
            <b className="font-semibold">{formatNumber(value)}</b>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link
            to="/stations/$stationId"
            params={{ stationId: station.station_id }}
          >
            Ouvrir le direct
          </Link>
        </Button>
      </div>
    </Card>
  )
}
