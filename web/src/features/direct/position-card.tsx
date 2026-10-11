import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { RouteIcon, ThermometerIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { ACC_STATUS, type Sample } from "@/contracts/telemetry"
import { pointAt, type Point } from "@/features/direct/geometry"
import type { TrailPoint } from "@/features/direct/history"
import { trackMapQueryOptions } from "@/features/direct/queries"
import { RealTrackMap, SchematicMap } from "@/features/direct/track-maps"
import {
  formatDecimal,
  formatLapTime,
  formatNumber,
  formatTemperature,
} from "@/lib/format"
import { cn } from "@/lib/utils"

/** Mini-carte de temperature (design.md 8 : TemperatureChip). */
function TemperatureChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number | null | undefined
}) {
  return (
    <div className="flex flex-[1_1_140px] items-center gap-2.5 rounded-md border border-card-border bg-card-inner px-3.5 py-2.5 whitespace-nowrap">
      {icon}
      <div className="flex flex-col">
        <span className="text-meta text-muted-foreground">{label}</span>
        <span className="text-card-title">{formatTemperature(value)}</span>
      </div>
    </div>
  )
}

function LegendLine({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn("h-1 w-4 rounded-full", className)}
      />
      {label}
    </li>
  )
}

/**
 * Position sur le tour (design.md 8 : TrackMap). Avec une carte enregistree par le serveur :
 * vrai trace, voiture placee par x et z (sinon par track_pos), trace du tour en cours.
 * Sans carte (404) : trace schematique de la maquette.
 */
export function PositionCard({
  sample,
  track,
  trail,
}: {
  sample: Sample
  track: string
  trail: TrailPoint[]
}) {
  const map = useQuery(trackMapQueryOptions(track))
  const pos = sample.track_pos
  const paused = sample.status === ACC_STATUS.pause
  const percent = Math.round(pos * 100)

  let drawing: ReactNode
  let note: ReactNode
  if (map.data) {
    const hasCoordinates = sample.x != null && sample.z != null
    const car: Point | null = hasCoordinates
      ? [sample.x as number, sample.z as number]
      : pointAt(map.data.points, pos)
    drawing = (
      <RealTrackMap
        map={map.data}
        trail={trail}
        car={car}
        paused={paused}
        label={`Carte du circuit ${track}, la voiture est à ${percent} % du tour${paused ? ", en pause" : ""}`}
      />
    )
    note = (
      <>
        {trail.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <LegendLine
              className="bg-primary"
              label="Tour en cours, sur la piste"
            />
            <LegendLine
              className="bg-chart-2 opacity-50"
              label="Hors piste (plus de 12 m de la trajectoire) ou stands"
            />
          </ul>
        ) : null}
        <p>
          Carte : {map.data.strategy === "latest" ? "dernier" : "meilleur"} tour
          enregistré ({map.data.station_id},{" "}
          {formatLapTime(map.data.lap_time_ms)},{" "}
          {formatNumber(Math.round(map.data.length_m))}&nbsp;m).
          {hasCoordinates
            ? ""
            : " L'agent n'envoie pas x et z : la voiture est placée avec track_pos."}
        </p>
      </>
    )
  } else {
    drawing = <SchematicMap pos={pos} paused={paused} />
    note = (
      <p>
        Tracé schématique : pas encore de carte pour ce circuit. Le serveur en
        enregistre une après un tour valide avec les coordonnées x et z.
      </p>
    )
  }

  return (
    <Card className="px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-card-title">Position sur la piste</h2>
        <span className="text-caption text-muted-foreground">
          {formatDecimal(pos, 2)} · secteur {sample.sector + 1}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <TemperatureChip
          icon={
            <ThermometerIcon
              aria-hidden="true"
              className="size-5.5 text-primary-text"
            />
          }
          label="Température de l'air"
          value={sample.air_temp_c}
        />
        <TemperatureChip
          icon={
            <RouteIcon
              aria-hidden="true"
              className="size-5.5 text-primary-text"
            />
          }
          label="Température de la piste"
          value={sample.road_temp_c}
        />
      </div>

      {drawing}

      <div className="flex flex-col gap-1 text-meta text-muted-foreground">
        {note}
      </div>
    </Card>
  )
}
