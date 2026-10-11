import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import { EMPTY_HISTORY, type RaceEvent } from "./history"
import { buildLapRows, describeEvent, isYellowEvent } from "./rows"

const base = samplesEventSchema.parse(samplesEvent).samples[0]
const sample = (overrides: Partial<Sample> = {}): Sample => ({
  ...base,
  ...overrides,
})

describe("buildLapRows", () => {
  it("tour en cours en tete, puis les tours valides du plus recent au plus ancien", () => {
    const { rows, hidden } = buildLapRows(
      sample({ completed_laps: 4, lap_time_ms: 2_460, is_valid_lap: false }),
      {
        ...EMPTY_HISTORY,
        laps: [
          { number: 1, timeMs: 108_000, valid: true },
          { number: 2, timeMs: 105_000, valid: false }, // plus rapide mais invalide
          { number: 3, timeMs: 106_797, valid: true },
          { number: 4, timeMs: 107_000, valid: null }, // validite non lue
        ],
      }
    )

    expect(rows.map((r) => [r.label, r.timeMs, r.gap, r.validity])).toEqual([
      ["5 (en cours)", 2_460, null, "invalid"],
      ["3", 106_797, "best", "valid"],
      ["1", 108_000, -1_203, "valid"],
    ])
    expect(hidden).toBe(2)
  })

  it("un temps inconnu n'a pas d'ecart", () => {
    const { rows } = buildLapRows(sample({ is_valid_lap: null }), {
      ...EMPTY_HISTORY,
      laps: [{ number: 1, timeMs: null, valid: true }],
    })

    expect(rows[0].validity).toBe("unknown")
    expect(rows[1]).toMatchObject({ gap: null, validity: "valid" })
  })
})

describe("describeEvent", () => {
  const event = (fields: Partial<RaceEvent>): RaceEvent =>
    ({
      id: "x",
      lap: 1,
      lapTimeMs: 0,
      startedAt: 0,
      endedAt: null,
      kind: "flag",
      code: 2,
      ...fields,
    }) as RaceEvent

  it("donne un nom lisible, ou le numero d'un code inconnu", () => {
    expect(describeEvent(event({ kind: "penalty", code: 1 }))).toBe(
      "Drive-through (coupure de piste)"
    )
    expect(describeEvent(event({ kind: "penalty", code: 42 }))).toBe(
      "Pénalité (code 42)"
    )
    expect(
      describeEvent(event({ kind: "track_flag", code: "yellow_s3" }))
    ).toBe("Drapeau jaune secteur 3")
  })

  it("reconnait les drapeaux jaunes", () => {
    expect(isYellowEvent(event({ kind: "flag", code: 2 }))).toBe(true)
    expect(
      isYellowEvent(event({ kind: "track_flag", code: "yellow_s1" }))
    ).toBe(true)
    expect(isYellowEvent(event({ kind: "flag", code: 1 }))).toBe(false)
  })
})
