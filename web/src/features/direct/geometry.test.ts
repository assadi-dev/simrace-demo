import { describe, expect, it } from "vitest"

import {
  boundsOf,
  buildTrackIndex,
  distanceToTrack,
  GAUGE,
  gaugeSegments,
  pointAt,
  SPEED_GAUGE_MAX_KMH,
  splitTrail,
} from "./geometry"

const lit = (speed: number) => gaugeSegments(speed).filter((s) => s.on).length

describe("gaugeSegments", () => {
  it("allume les segments au prorata de la vitesse, bornee a 0..max", () => {
    const max = SPEED_GAUGE_MAX_KMH
    expect(gaugeSegments(0)).toHaveLength(GAUGE.segments)
    expect(lit(0)).toBe(0)
    expect(lit(max / 2)).toBe(12)
    expect(lit(max)).toBe(24)
    expect(lit(max + 80)).toBe(24)
  })

  it("part de la gauche (0 km/h) vers la droite", () => {
    const segments = gaugeSegments(100)
    expect(segments[0].x1).toBeLessThan(GAUGE.cx)
    expect(segments[GAUGE.segments - 1].x1).toBeGreaterThan(GAUGE.cx)
  })
})

describe("pointAt", () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ] as const

  it("interpole entre deux points voisins", () => {
    expect(pointAt(square, 0)).toEqual([0, 0])
    expect(pointAt(square, 0.125)).toEqual([5, 0])
    expect(pointAt(square, 0.5)).toEqual([10, 10])
  })

  it("referme le tour sur le premier point", () => {
    expect(pointAt(square, 0.875)).toEqual([0, 5])
    expect(pointAt(square, 1)).toEqual([0, 0])
  })

  it("rend null sans trace", () => {
    expect(pointAt([], 0.3)).toBeNull()
  })
})

describe("carte reelle", () => {
  // ligne droite de 0 a 300 m le long de x, un point tous les 5 m, puis retour (tour ferme)
  const out = Array.from({ length: 61 }, (_, i) => [i * 5, 0] as const)
  const back = Array.from({ length: 59 }, (_, i) => [295 - i * 5, 40] as const)
  const index = buildTrackIndex([...out, ...back])

  it("distanceToTrack mesure l'ecart au segment le plus proche", () => {
    expect(distanceToTrack(index, [102.5, 3])).toBeCloseTo(3)
    expect(distanceToTrack(index, [150, -10])).toBeCloseTo(10)
    expect(distanceToTrack(index, [150, -200])).toBe(Infinity)
  })

  it("splitTrail separe piste, hors piste et stands, sans trou entre troncons", () => {
    const runs = splitTrail(
      [
        { x: 10, z: 1, inPit: false },
        { x: 20, z: 2, inPit: false },
        { x: 30, z: 20, inPit: false }, // 18 m de la reference : hors piste
        { x: 40, z: 1, inPit: false },
        { x: 50, z: 1, inPit: true }, // stands
      ],
      index
    )

    expect(runs.map((r) => [r.onTrack, r.points.length])).toEqual([
      [true, 2],
      [false, 2],
      [true, 2],
      [false, 2],
    ])
    expect(runs[1].points[0]).toEqual([20, 2])
  })

  it("sans reference, seuls les stands sont hors piste", () => {
    const runs = splitTrail(
      [
        { x: 0, z: 500, inPit: false },
        { x: 0, z: 510, inPit: true },
      ],
      null
    )
    expect(runs.map((r) => r.onTrack)).toEqual([true, false])
  })

  it("boundsOf ajoute la marge autour des points", () => {
    expect(
      boundsOf(
        [
          [0, 0],
          [100, 50],
        ],
        10
      )
    ).toEqual({ x: -10, z: -10, width: 120, height: 70 })
  })
})
