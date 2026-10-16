import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("cn", () => {
  it("garde une taille du design system a cote d'une couleur de texte", () => {
    expect(cn("text-badge", "text-success-text")).toBe("text-badge text-success-text")
    expect(cn("text-table-head text-muted-foreground")).toBe(
      "text-table-head text-muted-foreground"
    )
  })

  it("fusionne toujours deux tailles ou deux couleurs", () => {
    expect(cn("text-badge", "text-meta")).toBe("text-meta")
    expect(cn("text-foreground", "text-muted-foreground")).toBe("text-muted-foreground")
  })
})
