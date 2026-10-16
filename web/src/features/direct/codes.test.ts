import { describe, expect, it } from "vitest"

import { describeFlag } from "./codes"

describe("describeFlag", () => {
  it("nomme les codes envoyes par l'agent, vert et orange compris (AC EVO)", () => {
    expect([1, 5, 7, 8].map(describeFlag)).toEqual([
      "Drapeau bleu",
      "Drapeau à damier",
      "Drapeau vert",
      "Drapeau orange (problème mécanique)",
    ])
  })

  it("affiche le numero d'un code inconnu, sans inventer de nom", () => {
    expect(describeFlag(42)).toBe("Drapeau (code 42)")
  })
})
