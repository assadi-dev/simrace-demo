/*
 * Geometrie des dessins de l'ecran Direct (fonctions pures, testees).
 */

/** Vitesse en bout de jauge (km/h). Au-dela, la jauge reste pleine ; la valeur affichee est exacte. */
export const SPEED_GAUGE_MAX_KMH = 320

/** Jauge : demi-cercle 0 a SPEED_GAUGE_MAX_KMH en 24 segments (design.md 3 et 8, maquette 2). */
export const GAUGE = {
  segments: 24,
  cx: 160,
  cy: 166,
  rIn: 104,
  rOut: 146,
} as const

export type GaugeSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  on: boolean
  /** 0 a 1 : position dans le degrade (des allumes ou des eteints). */
  shade: number
}

/** Un segment est allume si son milieu est atteint par la vitesse. */
export function gaugeSegments(speedKmh: number): GaugeSegment[] {
  const { segments, cx, cy, rIn, rOut } = GAUGE
  const fill = Math.max(0, Math.min(1, speedKmh / SPEED_GAUGE_MAX_KMH))
  return Array.from({ length: segments }, (_, i) => {
    const center = (i + 0.5) / segments
    const angle = Math.PI - center * Math.PI
    const on = center <= fill
    const r1 = rIn + 7
    const r2 = rOut - 7
    return {
      x1: cx + r1 * Math.cos(angle),
      y1: cy - r1 * Math.sin(angle),
      x2: cx + r2 * Math.cos(angle),
      y2: cy - r2 * Math.sin(angle),
      on,
      shade: on ? center / fill : (center - fill) / (1 - fill || 1),
    }
  })
}

export type Point = readonly [number, number]

/**
 * Point du tracé a la position `pos` (0 a 1 le long du tour), par interpolation lineaire entre
 * des points regulierement espaces. Meme forme que GET /tracks/{circuit}/reference :
 * points[i] est a la position i / points.length, et le tour se referme sur points[0].
 */
export function pointAt(points: readonly Point[], pos: number): Point | null {
  if (points.length === 0) return null
  const scaled = (((pos % 1) + 1) % 1) * points.length
  const i = Math.floor(scaled)
  const t = scaled - i
  const [x1, y1] = points[i]
  const [x2, y2] = points[(i + 1) % points.length]
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
}

/*
 * Carte reelle : distance a la trajectoire de reference et decoupage de la trace roulee.
 * La reference est un tour roule (pas l'axe de la piste) : une piste fait 12 a 15 m de large,
 * au-dela de 12 m de cette trajectoire la voiture est consideree hors de la piste.
 */
export const OFF_TRACK_M = 12
const CELL_M = 25

export type TrackIndex = {
  points: readonly Point[]
  /** "cx:cz" -> indices des points de la cellule */
  cells: Map<string, number[]>
}

const cellKey = (cx: number, cz: number) => `${cx}:${cz}`

/** Grille de 25 m sur la reference : chercher le segment le plus proche coute 9 cellules. */
export function buildTrackIndex(points: readonly Point[]): TrackIndex {
  const cells = new Map<string, number[]>()
  points.forEach(([x, z], i) => {
    const key = cellKey(Math.floor(x / CELL_M), Math.floor(z / CELL_M))
    const cell = cells.get(key)
    if (cell) cell.push(i)
    else cells.set(key, [i])
  })
  return { points, cells }
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const lengthSq = dx * dx + dz * dz
  const t =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSq)
        )
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz))
}

/**
 * Distance (m) au segment de reference le plus proche. Infinity si rien a moins d'une cellule :
 * c'est de toute facon hors de la piste.
 */
export function distanceToTrack(index: TrackIndex, p: Point): number {
  const { points, cells } = index
  const n = points.length
  const cx = Math.floor(p[0] / CELL_M)
  const cz = Math.floor(p[1] / CELL_M)
  let best = Infinity
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cz - 1; j <= cz + 1; j++) {
      for (const k of cells.get(cellKey(i, j)) ?? []) {
        // le tour est ferme : le dernier point rejoint le premier
        best = Math.min(
          best,
          segmentDistance(p, points[k], points[(k + 1) % n]),
          segmentDistance(p, points[(k - 1 + n) % n], points[k])
        )
      }
    }
  }
  return best
}

export type TrailInput = { x: number; z: number; inPit: boolean }
export type TrailRun = { onTrack: boolean; points: Point[] }

/**
 * Decoupe la trace en troncons : sur la piste (hors stands et a moins de OFF_TRACK_M de la
 * reference) ou non. Un troncon reprend le dernier point du precedent : la ligne reste continue.
 */
export function splitTrail(
  trail: readonly TrailInput[],
  index: TrackIndex | null
): TrailRun[] {
  const runs: TrailRun[] = []
  for (const { x, z, inPit } of trail) {
    const point: Point = [x, z]
    const onTrack =
      !inPit && (index === null || distanceToTrack(index, point) <= OFF_TRACK_M)
    const last = runs.at(-1)
    if (last && last.onTrack === onTrack) {
      last.points.push(point)
    } else {
      runs.push({
        onTrack,
        points: last ? [last.points[last.points.length - 1], point] : [point],
      })
    }
  }
  return runs
}

/** Boite englobante, marge comprise, pour le viewBox du dessin (unites : metres). */
export function boundsOf(points: readonly Point[], margin: number) {
  let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, z] of points) {
    minX = Math.min(minX, x)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxZ = Math.max(maxZ, z)
  }
  return {
    x: minX - margin,
    z: minZ - margin,
    width: maxX - minX + 2 * margin,
    height: maxZ - minZ + 2 * margin,
  }
}
