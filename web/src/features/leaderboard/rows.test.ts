import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import stationsFixture from "@/contracts/fixtures/stations.json"
import { stationListSchema } from "@/contracts/stations"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import type { LiveStation } from "@/stores/live-store"
import { buildDriverRows, listTracks } from "./rows"

const [sim1, sim3] = stationListSchema.parse(stationsFixture)
const baseSample = samplesEventSchema.parse(samplesEvent).samples[0]

const station = (id: string, track: string, online = true) => ({
  ...sim1,
  station_id: id,
  online,
  session: { ...sim1.session, track, driver: `Pilote ${id}` },
})

const live = (overrides: Partial<Sample>): LiveStation => ({
  session: sim1.session,
  latest: { ...baseSample, ...overrides },
  receivedAt: 0,
})

describe("buildDriverRows", () => {
  it("classe par tours completes puis position sur le tour, circuit par circuit", () => {
    const rows = buildDriverRows(
      [station("a", "monza"), station("b", "monza"), station("c", "monza"), station("d", "spa")],
      {
        a: live({ completed_laps: 2, track_pos: 0.1 }),
        b: live({ completed_laps: 3, track_pos: 0.05 }),
        c: live({ completed_laps: 2, track_pos: 0.9 }),
        d: live({ completed_laps: 0, track_pos: 0.2 }),
      }
    )
    const rank = Object.fromEntries(rows.map((r) => [r.stationId, r.rank]))

    expect(rank).toEqual({ b: 1, c: 2, a: 3, d: 1 })
  })

  it("place en dernier un poste sans direct, avec des valeurs inconnues (jamais inventees)", () => {
    const rows = buildDriverRows(
      [station("a", "monza"), station("muet", "monza")],
      { a: live({ completed_laps: 0, track_pos: 0 }) }
    )
    const muet = rows.find((r) => r.stationId === "muet")!

    expect(muet.rank).toBe(2)
    expect(muet.lap).toBeNull()
    expect(muet.lapTimeMs).toBeNull()
    expect(muet.bestLapMs).toBeNull()
  })

  it("convertit 0 (inconnu cote agent) en null et numerote le tour en cours", () => {
    const [row] = buildDriverRows([station("a", "monza")], {
      a: live({ completed_laps: 4, last_lap_ms: 0, best_lap_ms: 108_431, lap_time_ms: 12_000 }),
    })

    expect(row.lap).toBe(5)
    expect(row.lastLapMs).toBeNull()
    expect(row.bestLapMs).toBe(108_431)
    expect(row.lapTimeMs).toBe(12_000)
  })

  it("derive le statut : hors ligne, en pause, en ligne", () => {
    const rows = buildDriverRows(
      [station("off", "monza", false), station("pause", "monza"), station("ok", "monza")],
      {
        off: live({ status: 2 }),
        pause: live({ status: 3 }),
        ok: live({ status: 2 }),
      }
    )
    const status = Object.fromEntries(rows.map((r) => [r.stationId, r.status]))

    expect(status).toEqual({ off: "offline", pause: "paused", ok: "online" })
  })
})

describe("listTracks", () => {
  it("compte les pilotes par circuit, par ordre alphabetique", () => {
    const rows = buildDriverRows([sim3, sim1, station("x", "monza")], {})

    expect(listTracks(rows)).toEqual([
      { track: "monza", count: 2 },
      { track: "spa", count: 1 },
    ])
  })
})
