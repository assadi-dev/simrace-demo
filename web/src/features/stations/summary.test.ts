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
const sample = (overrides: Partial<Sample>): Sample => ({
  ...baseSample,
  ...overrides,
})

describe("sortStations", () => {
  it("compare les numeros de poste comme des nombres (sim-2 avant sim-10)", () => {
    const sorted = sortStations([
      station("sim-10", true),
      station("sim-2", true),
      station("sim-1", true),
    ])
    expect(sorted.map((s) => s.station_id)).toEqual([
      "sim-1",
      "sim-2",
      "sim-10",
    ])
  })

  it("met les postes en ligne d'abord, puis trie par identifiant", () => {
    const sorted = sortStations([
      station("sim-3", false),
      station("sim-2", true),
      station("sim-4", false),
      station("sim-1", true),
    ])

    expect(sorted.map((s) => s.station_id)).toEqual([
      "sim-1",
      "sim-2",
      "sim-3",
      "sim-4",
    ])
  })
})

describe("summarizeStations", () => {
  it("additionne les compteurs d'integrite de tous les postes", () => {
    const summary = summarizeStations([
      station("a", true, {
        samples: 1000,
        duplicates: 2,
        gaps: 1,
        rejected: 17,
      }),
      station("b", false, {
        samples: 212,
        duplicates: 0,
        gaps: 0,
        rejected: 3,
      }),
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
        best_lap_ms: 131_765,
        track_pos: 0.482,
      })
    )

    expect(strip(values.speed)).toBe("186,9 km/h")
    expect(strip(values.gearRpm)).toBe("4 · 8 029")
    expect(values.lapLabel).toBe("Tour 2")
    expect(values.lapTime).toBe("0:02,460")
    expect(values.lastLap).toBe("2:26,460")
    expect(values.bestLap).toBe("2:11,765")
    expect(strip(values.position)).toBe("48 %")
    expect(values.positionPercent).toBe(48)
    expect(values.sessionPhase).toBe("n.d.") // ACC ne donne pas de phase
  })

  it("affiche la phase de session d AC EVO", () => {
    const values = liveValues("online", sample({ session_phase: "Ended" }))

    expect(values.sessionPhase).toBe("Terminée")
  })

  it("affiche la place et les adversaires, hors ligne n.d.", () => {
    const racing = sample({ race_position: 3, opponents: 9 })

    expect(liveValues("online", racing)).toMatchObject({
      racePosition: "P3",
      opponents: "9",
    })
    expect(liveValues("offline", racing)).toMatchObject({
      racePosition: "n.d.",
      opponents: "n.d.",
    })
  })

  it("hors ligne : ne garde que le dernier et le meilleur tour, le reste n'est plus en direct", () => {
    const values = liveValues(
      "offline",
      sample({ speed_kmh: 200, last_lap_ms: 101_902, best_lap_ms: 100_500 })
    )

    expect(values.speed).toBe("n.d.")
    expect(values.position).toBe("n.d.")
    expect(values.positionPercent).toBe(0)
    expect(values.lastLap).toBe("1:41,902")
    expect(values.bestLap).toBe("1:40,500")
  })

  it("sans echantillon du flux : tout est n.d., rien n'est invente", () => {
    const values = liveValues("online", undefined)

    expect(values).toMatchObject({
      speed: "n.d.",
      gearRpm: "n.d.",
      lapLabel: "Tour n.d.",
      lapTime: "n.d.",
      lastLap: "n.d.",
      bestLap: "n.d.",
    })
  })
})
