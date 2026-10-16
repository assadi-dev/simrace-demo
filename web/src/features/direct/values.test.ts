import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import type { Lap } from "./laps"
import { EMPTY_HISTORY } from "./history"
import { directKpis, gearLabel } from "./values"

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

const byLabel = <T extends { label: string }>(items: T[], label: string) =>
  items.find((item) => item.label === label)

describe("gearLabel", () => {
  it("affiche R pour la marche arriere et N pour le point mort", () => {
    expect([-1, 0, 1, 6].map(gearLabel)).toEqual(["R", "N", "1", "6"])
  })
})

describe("directKpis", () => {
  it("affiche n.d. pour un reglage que l'agent n'envoie pas, sans l'inventer", () => {
    const kpis = directKpis(sample(), EMPTY_HISTORY)

    expect(byLabel(kpis, "TC · TC Cut")).toMatchObject({
      value: "n.d. · n.d.",
      help: "Non transmis par l'agent",
    })
    expect(byLabel(kpis, "ABS")?.value).toBe("n.d.")
  })

  it("affiche les reglages lus dans ACC", () => {
    const kpis = directKpis(
      sample({ tc_level: 7, tc_cut_level: 6, abs_level: 4, engine_map: 8 }),
      EMPTY_HISTORY
    )

    expect(byLabel(kpis, "TC · TC Cut")?.value).toBe("7 · 6")
    expect(byLabel(kpis, "ABS")?.value).toBe("4")
    expect(byLabel(kpis, "Map moteur")?.value).toBe("8")
  })

  it("affiche la place en course et les adversaires", () => {
    const racing = directKpis(
      sample({ race_position: 7, opponents: 9 }),
      EMPTY_HISTORY
    )
    expect(byLabel(racing, "Position")).toMatchObject({
      value: "7",
      help: "Sur 10 voitures",
    })
    expect(byLabel(racing, "Adversaires")?.value).toBe("9")

    const alone = directKpis(
      sample({ race_position: null, opponents: 0 }),
      EMPTY_HISTORY
    )
    expect(byLabel(alone, "Position")?.value).toBe("n.d.")
    expect(byLabel(alone, "Adversaires")).toMatchObject({
      value: "0",
      help: "Seul en piste",
    })
  })

  it("retrouve le tour du meilleur temps dans l'historique", () => {
    const kpis = directKpis(
      sample({ completed_laps: 2, last_lap_ms: 108_000, best_lap_ms: 107_900 }),
      {
        ...EMPTY_HISTORY,
        laps: [lap(1, 107_900, true), lap(2, 108_000, true)],
      }
    )

    expect(byLabel(kpis, "Tour en cours")?.value).toBe("3")
    expect(byLabel(kpis, "Dernier tour")).toMatchObject({
      value: "1:48,000",
      help: "Tour 2",
    })
    expect(byLabel(kpis, "Meilleur tour")).toMatchObject({
      value: "1:47,900",
      help: "Tour 1",
    })
  })
})
