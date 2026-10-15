import { describe, expect, it } from "vitest"

import { isSessionEnded, sessionPhaseLabel } from "./session-phase"

describe("sessionPhaseLabel", () => {
  it("traduit les phases connues d'AC EVO", () => {
    expect(
      ["Waiting_For_Start", "Session", "Ended"].map(sessionPhaseLabel)
    ).toEqual(["En attente du départ", "En cours", "Terminée"])
  })

  it("affiche une phase inconnue telle que le jeu l'ecrit", () => {
    expect(sessionPhaseLabel("Race_Over")).toBe("Race Over")
  })

  it("affiche n.d. quand le jeu ne donne pas de phase (ACC)", () => {
    expect([null, undefined, ""].map(sessionPhaseLabel)).toEqual([
      "n.d.",
      "n.d.",
      "n.d.",
    ])
  })
})

describe("isSessionEnded", () => {
  it("ne vaut vrai que pour la phase Ended", () => {
    expect(["Ended", "Session", null].map(isSessionEnded)).toEqual([
      true,
      false,
      false,
    ])
  })
})
