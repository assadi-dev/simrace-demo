import { describe, expect, it } from "vitest"

import { trackSlug } from "./queries"

describe("trackSlug (miroir de Slug.from_untrusted)", () => {
  it("met en minuscules, retire les accents et remplace le reste par _", () => {
    expect(trackSlug("Imola")).toBe("imola")
    expect(trackSlug("Nürburgring GP")).toBe("nurburgring_gp")
    expect(trackSlug("  spa--")).toBe("spa")
    expect(trackSlug("monza_2019")).toBe("monza_2019")
  })
})
