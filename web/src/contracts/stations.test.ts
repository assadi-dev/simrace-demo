import { describe, expect, it } from "vitest"

import stations from "./fixtures/stations.json"
import { stationListSchema, stationSchema } from "./stations"

// stations.json est une vraie reponse de GET /stations (deux postes sur deux circuits).
describe("contrat GET /stations", () => {
  it("accepte une reponse reelle du serveur", () => {
    const parsed = stationListSchema.parse(stations)

    expect(parsed.map((s) => s.station_id)).toEqual(["sim-1", "sim-3"])
    expect(parsed[0].session.track).toBe("monza")
    expect(parsed[0].reject_reasons).toEqual({})
  })

  it("convertit last_seen en Date", () => {
    const [station] = stationListSchema.parse(stations)

    expect(station.last_seen).toBeInstanceOf(Date)
  })

  it("accepte un poste jamais vu (last_seen et machine a null)", () => {
    const parsed = stationSchema.parse({
      ...stations[0],
      last_seen: null,
      machine: null,
    })

    expect(parsed.last_seen).toBeNull()
    expect(parsed.machine).toBeNull()
  })

  it("rejette un compteur d'integrite manquant", () => {
    const withoutGaps = Object.fromEntries(
      Object.entries(stations[0]).filter(([key]) => key !== "gaps")
    )

    expect(stationSchema.safeParse(withoutGaps).success).toBe(false)
  })

  it("garde les raisons de rejet sous forme champ:type -> nombre", () => {
    const parsed = stationSchema.parse({
      ...stations[0],
      reject_reasons: { "speed_kmh:less_than_equal": 3 },
    })

    expect(parsed.reject_reasons["speed_kmh:less_than_equal"]).toBe(3)
  })
})
