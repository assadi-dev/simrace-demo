import type { ReactNode } from "react"
import { RouteIcon, ThermometerIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { ACC_STATUS, type Sample } from "@/contracts/telemetry"
import { pointAt, type Point } from "@/features/direct/geometry"
import { formatDecimal, formatTemperature } from "@/lib/format"

/** Trace schematique de la maquette 2 ; le depart est au debut du chemin. */
const SCHEMATIC_PATH =
  "M60,150 C40,100 70,50 130,50 L210,50 C260,50 290,80 270,120 C255,150 220,150 200,165 C180,185 120,190 90,175 C70,168 62,160 60,150 Z"
const SAMPLES = 256

let schematicPoints: Point[] | null = null

/**
 * Points regulierement espaces le long du trace, mesures une fois par le navigateur sur un
 * element detache (jsdom ne sait pas mesurer : liste vide, pas de curseur).
 */
function getSchematicPoints(): Point[] {
  if (schematicPoints) return schematicPoints
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  if (typeof path.getTotalLength !== "function") return []
  path.setAttribute("d", SCHEMATIC_PATH)
  const length = path.getTotalLength()
  schematicPoints = Array.from({ length: SAMPLES }, (_, i) => {
    const p = path.getPointAtLength((i / SAMPLES) * length)
    return [p.x, p.y] as const
  })
  return schematicPoints
}

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

/**
 * Position sur le tour (design.md 8 : TrackMap). Le tracé est schematique : la voiture y est
 * placee par track_pos. La vraie carte (GET /tracks/{circuit}/reference) viendra ensuite.
 */
export function PositionCard({ sample }: { sample: Sample }) {
  const pos = sample.track_pos
  const car = pointAt(getSchematicPoints(), pos)
  const paused = sample.status === ACC_STATUS.pause
  const percent = Math.round(pos * 100)

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
          icon={<ThermometerIcon aria-hidden="true" className="size-5.5 text-primary-text" />}
          label="Température de l'air"
          value={sample.air_temp_c}
        />
        <TemperatureChip
          icon={<RouteIcon aria-hidden="true" className="size-5.5 text-primary-text" />}
          label="Température de la piste"
          value={sample.road_temp_c}
        />
      </div>

      <svg
        viewBox="0 0 320 220"
        role="img"
        aria-label={`Tracé schématique du circuit, la voiture est à ${percent} % du tour${paused ? ", en pause" : ""}`}
        className="block h-auto w-full"
      >
        <path
          d={SCHEMATIC_PATH}
          fill="none"
          strokeWidth={14}
          strokeLinejoin="round"
          className="stroke-border-strong"
        />
        {/* partie du tour deja roulee : pathLength=1 rend la longueur egale a track_pos */}
        <path
          d={SCHEMATIC_PATH}
          pathLength={1}
          strokeDasharray={`${pos} 1`}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          className="stroke-primary"
        />
        <line x1={48} y1={158} x2={72} y2={142} strokeWidth={3} className="stroke-ink" />
        {car ? (
          paused ? (
            // carre = pause (design.md 8), la forme ne repose pas sur la couleur
            <rect
              x={car[0] - 8}
              y={car[1] - 8}
              width={16}
              height={16}
              rx={2}
              strokeWidth={3}
              className="fill-ink stroke-white"
            />
          ) : (
            <circle cx={car[0]} cy={car[1]} r={9} strokeWidth={3} className="fill-ink stroke-white" />
          )
        ) : null}
        <text x={84} y={200} fontSize={11} className="fill-muted-foreground">
          Départ / arrivée
        </text>
      </svg>

      <p className="text-meta text-muted-foreground">
        Tracé schématique : la voiture est placée avec track_pos (0 à 1), pas avec ses coordonnées.
      </p>
    </Card>
  )
}
