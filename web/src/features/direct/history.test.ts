import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import {
  activeEvents,
  advanceHistory,
  EMPTY_HISTORY,
  EMPTY_TRIP,
  resetTrip,
  type StationHistory,
} from "./history"

const base = samplesEventSchema.parse(samplesEvent).samples[0]

const sample = (t_ms: number, overrides: Partial<Sample> = {}): Sample => ({
  ...base,
  t_ms,
  status: 2,
  ...overrides,
})

/** Rejoue une suite d'echantillons comme le fait le store. */
function replay(samples: Sample[], start = EMPTY_HISTORY): StationHistory {
  let history = start
  let previous: Sample | undefined
  for (const s of samples) {
    history = advanceHistory(history, previous, s)
    previous = s
  }
  return history
}

describe("tours", () => {
  it("un tour termine quand completed_laps augmente, avec last_lap_ms et la validite du tour", () => {
    const history = replay([
      sample(0, { completed_laps: 0, is_valid_lap: false }),
      sample(17, {
        completed_laps: 1,
        last_lap_ms: 108_431,
        is_valid_lap: true,
      }),
    ])

    // la validite est celle du tour termine, pas du nouveau (detail : laps.test.ts)
    expect(history.laps).toMatchObject([
      { number: 1, timeMs: 108_431, valid: false },
    ])
  })

  it("un temps a 0 (inconnu cote ACC) et une validite absente restent inconnus", () => {
    const history = replay([
      sample(0, { completed_laps: 2, is_valid_lap: null }),
      sample(17, { completed_laps: 3, last_lap_ms: 0 }),
    ])

    expect(history.laps).toMatchObject([
      { number: 3, timeMs: null, valid: null },
    ])
  })

  it("completed_laps qui recule (nouvelle session) vide l'historique", () => {
    const before = replay([
      sample(0, { completed_laps: 4 }),
      sample(17, { completed_laps: 5, last_lap_ms: 100_000 }),
    ])
    const after = advanceHistory(
      before,
      sample(17, { completed_laps: 5 }),
      sample(34, { completed_laps: 0 })
    )

    expect(after.laps).toEqual([])
    expect(after.trip).toEqual(EMPTY_HISTORY.trip)
  })
})

describe("distance parcourue", () => {
  it("integre la vitesse entre deux echantillons (trapeze)", () => {
    // 180 km/h = 50 m/s, puis 216 km/h = 60 m/s, pendant 1 s : 55 m
    const history = replay([
      sample(0, { speed_kmh: 180 }),
      sample(1000, { speed_kmh: 216 }),
    ])

    expect(history.trip.distanceM).toBeCloseTo(55)
    expect(history.trip.drivenMs).toBe(1000)
  })

  it("ignore un trou (lots perdus) et la pause", () => {
    const history = replay([
      sample(0, { speed_kmh: 180 }),
      sample(5_000, { speed_kmh: 180 }), // 5 s sans echantillon : trou
      sample(5_017, { speed_kmh: 180, status: 3 }), // pause
      sample(5_034, { speed_kmh: 180, status: 3 }),
    ])

    expect(history.trip).toEqual({ distanceM: 0, drivenMs: 0 })
  })

  it("rend le meme objet quand rien ne change (pas de rendu inutile)", () => {
    const start = replay([sample(0)])
    const next = advanceHistory(
      start,
      sample(0, { status: 3 }),
      sample(17, { status: 3 })
    )

    expect(next).toBe(start)
  })
})

describe("drapeaux et penalites", () => {
  it("le vert n'est pas un evenement, le jaune global cede la place au jaune de secteur", () => {
    const keys = activeEvents(
      sample(0, { track_flags: ["green", "yellow", "yellow_s3"] })
    ).map((e) => `${e.kind}:${e.code}`)

    expect(keys).toEqual(["track_flag:yellow_s3"])
  })

  it("ouvre une penalite avec le tour et le moment, la ferme quand elle disparait", () => {
    const history = replay([
      sample(0, { completed_laps: 1, lap_time_ms: 41_000 }),
      sample(17, {
        completed_laps: 1,
        lap_time_ms: 41_017,
        penalty_code: 1,
        penalty_time_s: 0,
      }),
      sample(34, { completed_laps: 1, lap_time_ms: 41_034, penalty_code: 1 }),
      sample(51, { completed_laps: 1, lap_time_ms: 41_051, penalty_code: 0 }),
    ])

    expect(history.events).toEqual([
      {
        id: "penalty:1@17",
        kind: "penalty",
        code: 1,
        penaltyTimeS: null,
        lap: 2,
        lapTimeMs: 41_017,
        startedAt: 17,
        endedAt: 51,
      },
    ])
  })

  it("garde un evenement par apparition, le plus recent d'abord", () => {
    const history = replay([
      sample(0, { track_flags: ["yellow_s1"] }),
      sample(17, { track_flags: [] }),
      sample(34, { flag: 1 }),
    ])

    expect(history.events.map((e) => [e.kind, e.code, e.endedAt])).toEqual([
      ["flag", 1, null],
      ["track_flag", "yellow_s1", 17],
    ])
  })
})

describe("trace roulee", () => {
  it("garde un point tous les 2 m et note le passage aux stands", () => {
    const history = replay([
      sample(0, { x: 0, z: 0 }),
      sample(17, { x: 1, z: 0 }), // a moins de 2 m : ignore
      sample(34, { x: 3, z: 0 }),
      sample(51, { x: 3.5, z: 0, in_pit: true }), // stands : garde meme tout pres
    ])

    expect(history.trail).toEqual([
      { x: 0, z: 0, inPit: false },
      { x: 3, z: 0, inPit: false },
      { x: 3.5, z: 0, inPit: true },
    ])
  })

  it("repart a zero au passage de ligne, par le compteur ou par la position", () => {
    const byCounter = replay([
      sample(0, { x: 0, z: 0, completed_laps: 0 }),
      sample(17, { x: 50, z: 0, completed_laps: 1 }),
    ])
    const byPosition = replay([
      sample(0, { x: 0, z: 0, track_pos: 0.99 }),
      sample(17, { x: 50, z: 0, track_pos: 0.01 }),
    ])

    expect(byCounter.trail).toEqual([{ x: 50, z: 0, inPit: false }])
    expect(byPosition.trail).toEqual([{ x: 50, z: 0, inPit: false }])
  })

  it("reste vide sans coordonnees", () => {
    expect(replay([sample(0), sample(17)]).trail).toEqual([])
  })
})

describe("resetTrip", () => {
  it("remet la distance a zero sans toucher aux tours", () => {
    const history = replay([
      sample(0, { completed_laps: 0 }),
      sample(500, { completed_laps: 1, last_lap_ms: 100_000 }),
    ])

    const reset = resetTrip(history)
    expect(reset.trip).toBe(EMPTY_TRIP)
    expect(reset.laps).toBe(history.laps)
  })
})
