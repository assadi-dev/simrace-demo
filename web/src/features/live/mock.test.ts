import { describe, expect, it } from "vitest"

import { stationListSchema } from "@/contracts/stations"
import { ACC_STATUS, samplesEventSchema } from "@/contracts/telemetry"
import {
  advanceMockSample,
  createMockFeed,
  MOCK_POSTERS,
  mockSamplesEventsJson,
  mockStationsJson,
  tickMockFeed,
} from "@/features/live/mock"

const NOW = Date.UTC(2026, 9, 12, 18, 0, 0)

describe("donnees de demo de la page Live", () => {
  it("ont la forme exacte des reponses du serveur (schemas du contrat, sans champ en plus)", () => {
    expect(() => stationListSchema.parse(mockStationsJson(NOW))).not.toThrow()
    for (const event of mockSamplesEventsJson(NOW)) {
      expect(() => samplesEventSchema.strict().parse(event)).not.toThrow()
    }
  })

  it("remplissent la mosaique : 15 postes, 13 en ligne dont 2 en pause, 2 hors ligne", () => {
    const feed = createMockFeed(NOW)
    const status = (e: (typeof feed)[number]) => e.live?.latest.status
    expect(feed).toHaveLength(15)
    expect(feed.filter((e) => !e.station.online)).toHaveLength(2)
    expect(
      feed.filter((e) => e.station.online && status(e) === ACC_STATUS.pause)
    ).toHaveLength(2)
    expect(new Set(feed.map((e) => e.station.station_id)).size).toBe(15)
  })

  it("donnent a chaque poste l'affiche de son circuit, les stands en pause", () => {
    const sim3 = MOCK_POSTERS["sim-3"]
    expect(MOCK_POSTERS["sim-12"]).toBe(sim3)
    expect(MOCK_POSTERS["sim-13"]).toBe(MOCK_POSTERS["sim-1"])
    expect(MOCK_POSTERS["sim-15"]).toBeUndefined()
  })

  it("couvrent les trois etats des maquettes : en ligne, en pause, hors ligne", () => {
    const feed = createMockFeed(NOW)
    const sim3 = feed.find((e) => e.station.station_id === "sim-3")
    const sim4 = feed.find((e) => e.station.station_id === "sim-4")
    expect(sim3?.live?.latest.status).toBe(ACC_STATUS.pause)
    // le serveur dit un poste hors ligne apres 5 s sans lot
    expect(sim4?.station.online).toBe(false)
    expect(NOW - (sim4?.station.last_seen?.getTime() ?? NOW)).toBeGreaterThan(
      5000
    )
  })
})

describe("advanceMockSample", () => {
  const rolling = createMockFeed(NOW).find(
    (e) => e.station.station_id === "sim-1"
  )!.live!.latest

  it("fait avancer le temps du tour et la position", () => {
    const next = advanceMockSample(rolling, 200)
    expect(next.t_ms).toBe(rolling.t_ms + 200)
    expect(next.lap_time_ms).toBe(rolling.lap_time_ms + 200)
    expect(next.track_pos).toBeGreaterThan(rolling.track_pos)
  })

  it("termine le tour au temps du meilleur tour et repart de zero", () => {
    const end = { ...rolling, lap_time_ms: rolling.best_lap_ms - 100 }
    const next = advanceMockSample(end, 200)
    expect(next.completed_laps).toBe(rolling.completed_laps + 1)
    expect(next.last_lap_ms).toBe(rolling.best_lap_ms)
    expect(next.lap_time_ms).toBe(100)
  })

  it("reste dans les bornes du contrat", () => {
    let sample = rolling
    for (let i = 0; i < 1000; i++) {
      sample = advanceMockSample(sample, 200)
      expect(() =>
        samplesEventSchema.shape.samples.element.parse(sample)
      ).not.toThrow()
    }
  })

  it("laisse fige un poste en pause", () => {
    const paused = { ...rolling, status: ACC_STATUS.pause }
    expect(advanceMockSample(paused, 200)).toBe(paused)
  })
})

describe("tickMockFeed", () => {
  it("n'avance que les postes en ligne et note l'heure de reception", () => {
    const feed = createMockFeed(NOW)
    const next = tickMockFeed(feed, 200, NOW + 200)
    const sim1 = next.find((e) => e.station.station_id === "sim-1")
    const sim4 = next.find((e) => e.station.station_id === "sim-4")
    expect(sim1?.live?.receivedAt).toBe(NOW + 200)
    expect(sim4).toBe(feed.find((e) => e.station.station_id === "sim-4"))
  })
})
