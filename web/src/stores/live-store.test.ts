import { beforeEach, describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type SamplesEvent } from "@/contracts/telemetry"
import { useLiveStore } from "./live-store"

const base = samplesEventSchema.parse(samplesEvent)

/** Evenement `samples` pour un poste, un echantillon par valeur de t_ms. */
function event(stationId: string, times: number[], overrides = {}): SamplesEvent {
  return {
    ...base,
    station_id: stationId,
    samples: times.map((t_ms) => ({ ...base.samples[0], t_ms, ...overrides })),
  }
}

const state = () => useLiveStore.getState()

describe("live-store", () => {
  beforeEach(() => state().reset())

  it("garde l'echantillon le plus recent d'un lot", () => {
    state().pushSamples(event("sim-1", [100, 300, 200]), 1_000)

    expect(state().stations["sim-1"].latest.t_ms).toBe(300)
    expect(state().stations["sim-1"].receivedAt).toBe(1_000)
  })

  it("ignore un t_ms qui recule et ne rafraichit pas receivedAt", () => {
    state().pushSamples(event("sim-1", [500]), 1_000)
    state().pushSamples(event("sim-1", [400, 450]), 2_000)

    expect(state().stations["sim-1"].latest.t_ms).toBe(500)
    expect(state().stations["sim-1"].receivedAt).toBe(1_000)
  })

  it("ignore un t_ms repete (doublon)", () => {
    state().pushSamples(event("sim-1", [500], { speed_kmh: 100 }), 1_000)
    state().pushSamples(event("sim-1", [500], { speed_kmh: 250 }), 2_000)

    expect(state().stations["sim-1"].latest.speed_kmh).toBe(100)
  })

  it("suit chaque poste separement", () => {
    state().pushSamples(event("sim-1", [100]))
    state().pushSamples(event("sim-2", [900]))

    expect(Object.keys(state().stations).sort()).toEqual(["sim-1", "sim-2"])
    expect(state().stations["sim-1"].latest.t_ms).toBe(100)
  })

  it("deduit les tours d'un lot a l'autre, sans compter les echantillons ecartes", () => {
    state().pushSamples(event("sim-1", [100], { completed_laps: 0 }))
    // 50 recule : ecarte, il ne doit pas faire croire a un tour
    state().pushSamples(event("sim-1", [50], { completed_laps: 7 }))
    state().pushSamples(
      event("sim-1", [200], { completed_laps: 1, last_lap_ms: 108_431 })
    )

    expect(state().stations["sim-1"].history.laps).toEqual([
      { number: 1, timeMs: 108_431, valid: null },
    ])
  })

  it("ignore un lot vide", () => {
    state().pushSamples(event("sim-1", []))

    expect(state().stations).toEqual({})
  })

  it("compte les evenements hors contrat et se remet a zero", () => {
    state().countInvalidEvent()
    state().countInvalidEvent()
    state().setConnection("offline")
    expect(state().invalidEvents).toBe(2)

    state().reset()

    expect(state().invalidEvents).toBe(0)
    expect(state().connection).toBe("connecting")
  })
})
