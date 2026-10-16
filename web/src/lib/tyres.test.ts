import { describe, expect, it } from "vitest"

import { tyreTemperatures } from "./tyres"

describe("tyreTemperatures", () => {
  it("garde l'ordre du contrat et arrondit au degre", () => {
    expect(tyreTemperatures([81.6, 80.2, 77.5, 76.4])).toEqual([
      { wheel: "Avant gauche", short: "AVG", temperature: "82" },
      { wheel: "Avant droit", short: "AVD", temperature: "80" },
      { wheel: "Arrière gauche", short: "ARG", temperature: "78" },
      { wheel: "Arrière droit", short: "ARD", temperature: "76" },
    ])
  })

  it("affiche n.d. quand l'agent n'envoie pas les mesures, sans les inventer", () => {
    expect(tyreTemperatures(null).map((t) => t.temperature)).toEqual([
      "n.d.",
      "n.d.",
      "n.d.",
      "n.d.",
    ])
  })
})
