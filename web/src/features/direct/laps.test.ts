import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import { advanceLaps, BEST_SETTLE_MS, EMPTY_TRACKING, type Lap } from "./laps"

const base = samplesEventSchema.parse(samplesEvent).samples[0]

const sample = (t_ms: number, overrides: Partial<Sample> = {}): Sample => ({
  ...base,
  t_ms,
  status: 2,
  completed_laps: 0,
  track_pos: 0.5,
  is_valid_lap: true,
  last_lap_ms: 0,
  best_lap_ms: 0,
  ...overrides,
})

/** Rejoue une suite d'echantillons comme le fait l'historique. */
function replay(samples: Sample[]): Lap[] {
  let laps: Lap[] = []
  let tracking = EMPTY_TRACKING
  let previous: Sample | undefined
  for (const s of samples) {
    ;({ laps, tracking } = advanceLaps(laps, tracking, previous, s))
    previous = s
  }
  return laps
}

describe("validite retenue sur tout le tour", () => {
  it("un virage coupe invalide le tour, meme si ACC remet le drapeau a vrai avant la ligne", () => {
    const laps = replay([
      sample(0, { track_pos: 0.3 }),
      sample(100, { track_pos: 0.4, is_valid_lap: false }), // coupe
      sample(200, { track_pos: 0.95, is_valid_lap: true }), // ACC remet a vrai avant la ligne
      sample(300, { track_pos: 0.01, completed_laps: 1, last_lap_ms: 100_000 }),
    ])

    expect(laps).toEqual([
      {
        number: 1,
        timeMs: 100_000,
        valid: false,
        invalidReason: "acc_flag",
        bestCheckUntil: null,
      },
    ])
  })

  it("le tour de sortie (non compte par ACC) n'invalide pas le premier tour lance", () => {
    const laps = replay([
      sample(0, { track_pos: 0.8, is_valid_lap: false }), // tour de sortie
      sample(100, { track_pos: 0.99, is_valid_lap: false }),
      sample(200, { track_pos: 0.01 }), // ligne : le compteur reste a 0
      sample(300, { track_pos: 0.5 }),
      sample(400, { track_pos: 0.99 }),
      sample(500, {
        track_pos: 0.01,
        completed_laps: 1,
        last_lap_ms: 100_000,
        best_lap_ms: 100_000,
      }),
    ])

    expect(laps).toMatchObject([
      { number: 1, valid: true, invalidReason: null },
    ])
  })

  it("compteur et position qui signalent la meme ligne a quelques echantillons d'ecart : un seul tour", () => {
    const laps = replay([
      sample(0, { track_pos: 0.5, is_valid_lap: false }),
      sample(100, { track_pos: 0.99, is_valid_lap: false }),
      sample(200, { track_pos: 0.01 }), // la position boucle d'abord
      sample(300, { track_pos: 0.02 }),
      sample(400, { track_pos: 0.03, completed_laps: 1, last_lap_ms: 100_000 }),
    ])

    // le compteur ferme le tour deja ferme par la position : invalide, pas un tour vide
    expect(laps).toMatchObject([{ number: 1, valid: false }])
  })

  it("compteur en avance sur la position : le bouclage qui suit n'ouvre pas un autre tour", () => {
    const laps = replay([
      sample(0, { track_pos: 0.5 }),
      sample(100, { track_pos: 0.98, completed_laps: 1, last_lap_ms: 100_000 }),
      sample(200, { track_pos: 0.99, completed_laps: 1, is_valid_lap: false }),
      sample(300, { track_pos: 0.01, completed_laps: 1, is_valid_lap: false }),
      sample(400, { track_pos: 0.6, completed_laps: 1 }),
      sample(500, { track_pos: 0.99, completed_laps: 1 }),
      sample(600, { track_pos: 0.01, completed_laps: 2, last_lap_ms: 101_000 }),
    ])

    // le faux de 200 et 300 appartient au tour 2, ouvert par le compteur a 100
    expect(laps).toMatchObject([
      { number: 1, valid: true },
      { number: 2, valid: false, invalidReason: "acc_flag" },
    ])
  })

  it("deux hausses du compteur sans position qui avance sont deux tours distincts", () => {
    const laps = replay([
      sample(0),
      sample(100, { completed_laps: 1, last_lap_ms: 100_000 }),
      sample(200, { completed_laps: 1, is_valid_lap: false }),
      sample(300, { completed_laps: 2, last_lap_ms: 99_000 }),
    ])

    expect(laps).toMatchObject([
      { number: 1, valid: true },
      { number: 2, valid: false },
    ])
  })

  it("sans is_valid_lap, la validite reste inconnue", () => {
    const laps = replay([
      sample(0, { is_valid_lap: null }),
      sample(100, {
        is_valid_lap: null,
        completed_laps: 1,
        last_lap_ms: 100_000,
      }),
    ])

    expect(laps).toMatchObject([{ valid: null, bestCheckUntil: null }])
  })
})

describe("controle par le meilleur temps d'ACC", () => {
  const lapEnd = (t: number, best: number) =>
    sample(t, {
      track_pos: 0.01,
      completed_laps: 1,
      last_lap_ms: 100_000,
      best_lap_ms: best,
    })

  it("un tour plus rapide que le meilleur d'ACC, apres le delai, est invalide", () => {
    const pending = replay([
      sample(0, { best_lap_ms: 105_000 }),
      lapEnd(100, 105_000),
    ])
    expect(pending).toMatchObject([
      { valid: true, bestCheckUntil: 100 + BEST_SETTLE_MS },
    ])

    const laps = replay([
      sample(0, { best_lap_ms: 105_000 }),
      lapEnd(100, 105_000),
      sample(100 + BEST_SETTLE_MS, {
        completed_laps: 1,
        last_lap_ms: 100_000,
        best_lap_ms: 105_000,
      }),
    ])
    expect(laps).toMatchObject([
      {
        valid: false,
        invalidReason: "faster_than_acc_best",
        bestCheckUntil: null,
      },
    ])
  })

  it("un nouveau meilleur retenu par ACC (meme en retard) reste valide", () => {
    const laps = replay([
      sample(0, { best_lap_ms: 105_000 }),
      lapEnd(100, 105_000), // ACC n'a pas encore mis a jour son meilleur
      sample(150, {
        completed_laps: 1,
        last_lap_ms: 100_000,
        best_lap_ms: 100_000,
      }),
    ])

    expect(laps).toMatchObject([
      { valid: true, invalidReason: null, bestCheckUntil: null },
    ])
  })

  it("un tour plus lent que le meilleur est valide tout de suite", () => {
    const laps = replay([sample(0), lapEnd(100, 95_000)])

    expect(laps).toMatchObject([{ valid: true, bestCheckUntil: null }])
  })

  it("sans meilleur temps d'ACC (0), pas de conclusion : le tour reste valide", () => {
    const laps = replay([
      sample(0),
      lapEnd(100, 0),
      sample(100 + BEST_SETTLE_MS, { completed_laps: 1 }),
    ])

    expect(laps).toMatchObject([{ valid: true, bestCheckUntil: null }])
  })
})
