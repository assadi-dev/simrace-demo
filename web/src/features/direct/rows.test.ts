import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import type { Lap } from "./laps"
import { EMPTY_HISTORY, type RaceEvent } from "./history"
import { buildLapRows, describeEvent, isYellowEvent } from "./rows"

const base = samplesEventSchema.parse(samplesEvent).samples[0]
const sample = (overrides: Partial<Sample> = {}): Sample => ({
  ...base,
  ...overrides,
})

/** Tour termine et controle (laps.ts) ; un tour invalide l'est par is_valid_lap. */
const lap = (
  number: number,
  timeMs: number | null,
  valid: boolean | null
): Lap => ({
  number,
  timeMs,
  valid,
  invalidReason: valid === false ? "acc_flag" : null,
  bestCheckUntil: null,
})

describe("buildLapRows", () => {
  it("tour en cours en tete, puis les tours valides du plus recent au plus ancien", () => {
    const { rows, hidden } = buildLapRows(
      sample({ completed_laps: 4, lap_time_ms: 2_460, is_valid_lap: false }),
      {
        ...EMPTY_HISTORY,
        laps: [
          lap(1, 108_000, true),
          lap(2, 105_000, false), // plus rapide mais invalide
          lap(3, 106_797, true),
          lap(4, 107_000, null), // validite non lue
        ],
      }
    )

    expect(rows.map((r) => [r.label, r.timeMs, r.gap, r.validity])).toEqual([
      ["5 (en cours)", 2_460, null, "invalid"],
      ["3", 106_797, "best", "valid"],
      ["1", 108_000, -1_203, "valid"],
    ])
    expect(hidden).toEqual({
      accFlag: 1,
      fasterThanAccBest: 0,
      unknown: 1,
      pending: 0,
    })
  })

  it("n'affiche ni un tour en controle ni un tour plus rapide que le meilleur d'ACC", () => {
    const { rows, hidden } = buildLapRows(sample(), {
      ...EMPTY_HISTORY,
      laps: [
        { ...lap(1, 100_000, false), invalidReason: "faster_than_acc_best" },
        { ...lap(2, 101_000, true), bestCheckUntil: 5_000 },
      ],
    })

    expect(rows).toHaveLength(1) // le tour en cours seulement
    expect(hidden).toEqual({
      accFlag: 0,
      fasterThanAccBest: 1,
      unknown: 0,
      pending: 1,
    })
  })

  it("un temps inconnu n'a pas d'ecart", () => {
    const { rows } = buildLapRows(sample({ is_valid_lap: null }), {
      ...EMPTY_HISTORY,
      laps: [lap(1, null, true)],
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
