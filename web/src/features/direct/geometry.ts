/*
 * Geometrie des dessins de l'ecran Direct (fonctions pures, testees).
 */

/** Jauge : demi-cercle 0 a 420 km/h en 24 segments (design.md 3 et 8, maquette 2). */
export const GAUGE = {
  maxKmh: 420,
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
  const { maxKmh, segments, cx, cy, rIn, rOut } = GAUGE
  const fill = Math.max(0, Math.min(1, speedKmh / maxKmh))
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
