import { describe, expect, it } from "vitest"

import { opponentsLabel, racePositionHelp, racePositionLabel } from "./standing"

describe("place en course", () => {
  it("affiche la place et le nombre de voitures en course", () => {
    const sample = { race_position: 7, opponents: 9 }

    expect(racePositionLabel(sample)).toBe("P7")
    expect(opponentsLabel(sample)).toBe("9")
    expect(racePositionHelp(sample)).toBe("Sur 10 voitures")
  })

  it("seul en piste : 0 adversaire, pas de classement invente", () => {
    const sample = { race_position: null, opponents: 0 }

    expect(racePositionLabel(sample)).toBe("n.d.")
    expect(opponentsLabel(sample)).toBe("0")
    expect(racePositionHelp(sample)).toBe("Pas de classement, seul en piste")
  })

  it("affiche n.d. quand le jeu ne donne rien", () => {
    const sample = { race_position: undefined, opponents: undefined }

    expect(racePositionLabel(sample)).toBe("n.d.")
    expect(opponentsLabel(sample)).toBe("n.d.")
    expect(racePositionHelp(sample)).toBe("Non donnée par le jeu")
  })
})
