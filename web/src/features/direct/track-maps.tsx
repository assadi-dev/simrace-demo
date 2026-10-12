import { useMemo } from "react"

import type { TrackMap } from "@/contracts/tracks"
import {
  boundsOf,
  buildTrackIndex,
  pointAt,
  splitTrail,
  type Point,
} from "@/features/direct/geometry"
import type { TrailPoint } from "@/features/direct/history"

/** Voiture : rond, ou carre en pause (design.md 8 : la forme ne repose pas sur la couleur). */
function CarMarker({
  at,
  size,
  paused,
}: {
  at: Point
  /** Rayon en unites du dessin. */
  size: number
  paused: boolean
}) {
  return paused ? (
    <rect
      x={at[0] - size}
      y={at[1] - size}
      width={2 * size}
      height={2 * size}
      rx={size / 4}
      strokeWidth={3}
      vectorEffect="non-scaling-stroke"
      className="fill-ink stroke-white"
    />
  ) : (
    <circle
      cx={at[0]}
      cy={at[1]}
      r={size}
      strokeWidth={3}
      vectorEffect="non-scaling-stroke"
      className="fill-ink stroke-white"
    />
  )
}

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

/** Pas de carte enregistree pour ce circuit : trace schematique, voiture placee par track_pos. */
export function SchematicMap({
  pos,
  paused,
}: {
  pos: number
  paused: boolean
}) {
  const car = pointAt(getSchematicPoints(), pos)
  return (
    <svg
      viewBox="0 0 320 220"
      role="img"
      aria-label={`Tracé schématique du circuit, la voiture est à ${Math.round(pos * 100)} % du tour${paused ? ", en pause" : ""}`}
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
      <line
        x1={48}
        y1={158}
        x2={72}
        y2={142}
        strokeWidth={3}
        className="stroke-ink"
      />
      {car ? <CarMarker at={car} size={9} paused={paused} /> : null}
      <text x={84} y={200} fontSize={11} className="fill-muted-foreground">
        Départ / arrivée
      </text>
    </svg>
  )
}

const toPoints = (points: readonly Point[]) =>
  points.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(" ")

/**
 * Vraie carte du circuit (GET /tracks/{circuit}/reference), en metres : x vers la droite, z vers
 * le bas. Orientation verifiee sur Imola (sens inverse des aiguilles d'une montre, comme le vrai
 * circuit) ; inverser z donnerait le circuit en miroir.
 * La trace du tour en cours est orange sur la piste ; hors piste ou aux stands, elle prend une
 * autre couleur, attenuee.
 */
export function RealTrackMap({
  map,
  trail,
  car,
  paused,
  label,
}: {
  map: TrackMap
  trail: TrailPoint[]
  car: Point | null
  paused: boolean
  label: string
}) {
  const index = useMemo(() => buildTrackIndex(map.points), [map])
  const box = useMemo(() => boundsOf(map.points, 40), [map])
  const runs = useMemo(() => splitTrail(trail, index), [trail, index])
  // une unite du dessin schematique (320 de large) exprimee en metres
  const unit = Math.max(box.width, box.height) / 320

  const [start, next] = map.points
  const [dx, dz] = [next[0] - start[0], next[1] - start[1]]
  const norm = Math.hypot(dx, dz) || 1
  const half = 12 * unit
  const perp: Point = [(-dz / norm) * half, (dx / norm) * half]

  return (
    <svg
      viewBox={`${box.x} ${box.z} ${box.width} ${box.height}`}
      role="img"
      aria-label={label}
      className="block h-auto max-h-80 w-full"
    >
      <polygon
        points={toPoints(map.points)}
        fill="none"
        strokeWidth={14}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-border-strong"
      />
      {runs.map((run, i) => (
        <polyline
          key={i}
          data-on-track={run.onTrack}
          points={toPoints(run.points)}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={
            run.onTrack ? "stroke-primary" : "stroke-chart-2 opacity-50"
          }
        />
      ))}
      <line
        x1={start[0] - perp[0]}
        y1={start[1] - perp[1]}
        x2={start[0] + perp[0]}
        y2={start[1] + perp[1]}
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        className="stroke-ink"
      />
      {car ? <CarMarker at={car} size={9 * unit} paused={paused} /> : null}
    </svg>
  )
}
