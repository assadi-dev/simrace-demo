import { describe, expect, it } from "vitest"

import {
  formatAgo,
  formatDecimal,
  formatDelta,
  formatLapTime,
  formatTemperature,
  formatNumber,
  formatSpeed,
  NOT_AVAILABLE,
} from "./format"

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

describe("formats francais", () => {
  const strip = (value: string) => value.replace(/[\u00a0\u202f]/g, " ")

  it("formatNumber separe les milliers", () => {
    expect(strip(formatNumber(48212))).toBe("48 212")
    expect(formatNumber(17)).toBe("17")
  })

  it("formatSpeed garde une decimale", () => {
    expect(strip(formatSpeed(0))).toBe("0,0 km/h")
    expect(strip(formatSpeed(142.34))).toBe("142,3 km/h")
  })

  it("formatAgo passe des secondes aux minutes puis aux heures", () => {
    expect(strip(formatAgo(1_400))).toBe("il y a 1 s")
    expect(strip(formatAgo(59_999))).toBe("il y a 59 s")
    expect(strip(formatAgo(3 * 60_000))).toBe("il y a 3 min")
    expect(strip(formatAgo(2 * 3_600_000))).toBe("il y a 2 h")
  })

  it("formatAgo ramene a 0 une duree negative (horloges decalees)", () => {
    expect(strip(formatAgo(-5_000))).toBe("il y a 0 s")
  })

  it("formatTemperature garde une decimale, n.d. si absente", () => {
    expect(strip(formatTemperature(27.13))).toBe("27,1 °C")
    expect(formatTemperature(null)).toBe(NOT_AVAILABLE)
  })

  it("formatDelta : + plus rapide, signe moins U+2212 plus lent, 0,000 egal", () => {
    expect(formatDelta(512)).toBe("+0,512")
    expect(formatDelta(-1_203)).toBe("\u22121,203")
    expect(formatDelta(0)).toBe("0,000")
  })

  it("formatDecimal fixe le nombre de decimales", () => {
    expect(formatDecimal(1.234, 2)).toBe("1,23")
    expect(formatDecimal(2, 2)).toBe("2,00")
  })
})
