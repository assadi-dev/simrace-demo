import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import stationsFixture from "@/contracts/fixtures/stations.json"
import { stationListSchema } from "@/contracts/stations"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import { liveValues, sortStations, summarizeStations } from "./summary"

const [base] = stationListSchema.parse(stationsFixture)
const baseSample = samplesEventSchema.parse(samplesEvent).samples[0]
const station = (id: string, online: boolean, counters = {}) => ({
  ...base,
  station_id: id,
  online,
  ...counters,
})
const sample = (overrides: Partial<Sample>): Sample => ({ ...baseSample, ...overrides })

describe("sortStations", () => {
  it("met les postes en ligne d'abord, puis trie par identifiant", () => {
    const sorted = sortStations([
      station("sim-3", false),
      station("sim-2", true),
      station("sim-4", false),
      station("sim-1", true),
    ])

    expect(sorted.map((s) => s.station_id)).toEqual(["sim-1", "sim-2", "sim-3", "sim-4"])
  })
})

describe("summarizeStations", () => {
  it("additionne les compteurs d'integrite de tous les postes", () => {
    const summary = summarizeStations([
      station("a", true, { samples: 1000, duplicates: 2, gaps: 1, rejected: 17 }),
      station("b", false, { samples: 212, duplicates: 0, gaps: 0, rejected: 3 }),
    ])

    expect(summary).toEqual({
      total: 2,
      online: 1,
      samples: 1212,
      duplicates: 2,
      gaps: 1,
      rejected: 20,
    })
  })

  it("vaut zero partout sans poste", () => {
    expect(summarizeStations([]).total).toBe(0)
  })
})

describe("liveValues", () => {
  const strip = (value: string) => value.replace(/[\u00a0\u202f]/g, " ")

  it("formate le dernier echantillon d'un poste en ligne", () => {
    const values = liveValues(
      "online",
      sample({
        speed_kmh: 186.94,
        gear: 4,
        rpm: 8029,
        completed_laps: 1,
        lap_time_ms: 2460,
        last_lap_ms: 146_460,
        track_pos: 0.482,
      })
    )

    expect(strip(values.speed)).toBe("186,9 km/h")
    expect(strip(values.gearRpm)).toBe("4 · 8 029")
    expect(values.lapLabel).toBe("Tour 2")
    expect(values.lapTime).toBe("0:02,460")
    expect(values.lastLap).toBe("2:26,460")
    expect(strip(values.position)).toBe("48 %")
    expect(values.positionPercent).toBe(48)
  })

  it("hors ligne : ne garde que le dernier tour, le reste n'est plus en direct", () => {
    const values = liveValues("offline", sample({ speed_kmh: 200, last_lap_ms: 101_902 }))

    expect(values.speed).toBe("n.d.")
    expect(values.position).toBe("n.d.")
    expect(values.positionPercent).toBe(0)
    expect(values.lastLap).toBe("1:41,902")
  })

  it("sans echantillon du flux : tout est n.d., rien n'est invente", () => {
    const values = liveValues("online", undefined)

    expect(values).toMatchObject({
      speed: "n.d.",
      gearRpm: "n.d.",
      lapLabel: "Tour n.d.",
      lapTime: "n.d.",
      lastLap: "n.d.",
    })
  })
})
