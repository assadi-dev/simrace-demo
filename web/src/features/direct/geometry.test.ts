import { describe, expect, it } from "vitest"

import { GAUGE, gaugeSegments, pointAt } from "./geometry"

const lit = (speed: number) => gaugeSegments(speed).filter((s) => s.on).length

describe("gaugeSegments", () => {
  it("allume les segments au prorata de la vitesse, bornee a 0..420", () => {
    expect(gaugeSegments(0)).toHaveLength(GAUGE.segments)
    expect(lit(0)).toBe(0)
    expect(lit(210)).toBe(12)
    expect(lit(420)).toBe(24)
    expect(lit(500)).toBe(24)
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
