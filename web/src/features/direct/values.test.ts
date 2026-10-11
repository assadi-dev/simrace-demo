import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import { EMPTY_HISTORY } from "./history"
import { directKpis, gaugeStats, gearLabel } from "./values"

const base = samplesEventSchema.parse(samplesEvent).samples[0]
const sample = (overrides: Partial<Sample> = {}): Sample => ({ ...base, ...overrides })

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

  it("retrouve le tour du meilleur temps dans l'historique", () => {
    const kpis = directKpis(
      sample({ completed_laps: 2, last_lap_ms: 108_000, best_lap_ms: 107_900 }),
      {
        ...EMPTY_HISTORY,
        laps: [
          { number: 1, timeMs: 107_900, valid: true },
          { number: 2, timeMs: 108_000, valid: true },
        ],
      }
    )

    expect(byLabel(kpis, "Tour en cours")?.value).toBe("3")
    expect(byLabel(kpis, "Dernier tour")).toMatchObject({ value: "1:48,000", help: "Tour 2" })
    expect(byLabel(kpis, "Meilleur tour")).toMatchObject({ value: "1:47,900", help: "Tour 1" })
  })
})

describe("gaugeStats", () => {
  it("calcule la vitesse moyenne a partir de la distance et du temps roule", () => {
    const stats = gaugeStats(sample({ gear: 4 }), {
      ...EMPTY_HISTORY,
      trip: { distanceM: 5_000, drivenMs: 120_000 }, // 5 km en 2 min
    })

    expect(byLabel(stats, "Rapport")?.value).toBe("4")
    expect(byLabel(stats, "Distance parcourue")?.value).toBe("5,00")
    expect(byLabel(stats, "Vitesse moyenne")).toMatchObject({ value: "150", unit: "km/h" })
  })

  it("n'invente pas de moyenne avant d'avoir roule", () => {
    expect(byLabel(gaugeStats(sample(), EMPTY_HISTORY), "Vitesse moyenne")?.value).toBe("n.d.")
  })
})
