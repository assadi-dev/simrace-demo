import { describe, expect, it } from "vitest"

import { formatLapTime, NOT_AVAILABLE } from "./format"

describe("formatLapTime", () => {
  it("formate en m:ss,mmm", () => {
    expect(formatLapTime(108_431)).toBe("1:48,431")
    expect(formatLapTime(59_007)).toBe("0:59,007")
    expect(formatLapTime(3_600_000)).toBe("60:00,000")
  })

  it("affiche n.d. quand le temps est inconnu (0 cote agent, null, undefined)", () => {
    expect(formatLapTime(0)).toBe(NOT_AVAILABLE)
    expect(formatLapTime(null)).toBe(NOT_AVAILABLE)
    expect(formatLapTime(undefined)).toBe(NOT_AVAILABLE)
  })
})
