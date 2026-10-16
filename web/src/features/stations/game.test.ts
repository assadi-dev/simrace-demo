import { describe, expect, it } from "vitest"

import { gameLabel } from "./game"

describe("gameLabel", () => {
  it("nomme le jeu et sa version", () => {
    expect(gameLabel({ game: "acevo", game_version: "0.9.1" })).toBe(
      "AC EVO 0.9.1"
    )
    expect(gameLabel({ game: "acc", game_version: null })).toBe("ACC")
  })

  it("garde l'identifiant d'un jeu inconnu", () => {
    expect(gameLabel({ game: "forza", game_version: "7" })).toBe("forza 7")
  })

  it("affiche n.d. quand l'agent ne dit pas le jeu", () => {
    expect(gameLabel({ game: null, game_version: null })).toBe("Jeu n.d.")
    expect(gameLabel({})).toBe("Jeu n.d.")
  })
})
