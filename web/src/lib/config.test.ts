import { describe, expect, it } from "vitest"

import { parseConfig } from "./config"

describe("parseConfig", () => {
  it("prend les valeurs par defaut quand rien n'est defini (1 poste max)", () => {
    expect(parseConfig({})).toEqual({ apiUrl: "http://localhost:8000", maxStations: 1 })
  })

  it("traite une valeur vide comme absente", () => {
    expect(parseConfig({ VITE_API_URL: "", VITE_MAX_STATIONS: "" })).toEqual({
      apiUrl: "http://localhost:8000",
      maxStations: 1,
    })
  })

  it("lit l'URL du serveur et le nombre de postes max (texte du .env)", () => {
    expect(
      parseConfig({ VITE_API_URL: "http://10.192.2.241:8000/", VITE_MAX_STATIONS: "4" })
    ).toEqual({ apiUrl: "http://10.192.2.241:8000", maxStations: 4 })
  })

  it("refuse un nombre de postes invalide plutot que de l'afficher", () => {
    expect(() => parseConfig({ VITE_MAX_STATIONS: "quatre" })).toThrow()
    expect(() => parseConfig({ VITE_MAX_STATIONS: "0" })).toThrow()
    expect(() => parseConfig({ VITE_MAX_STATIONS: "2.5" })).toThrow()
  })

  it("refuse une URL de serveur invalide", () => {
    expect(() => parseConfig({ VITE_API_URL: "10.192.2.241:8000" })).toThrow()
  })
})
