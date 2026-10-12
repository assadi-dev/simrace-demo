import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema } from "@/contracts/telemetry"
import {
  liveStats,
  overlayTelemetry,
  roundedSpeed,
  SHOW_PAUSED_OVERLAY,
  videoOverlay,
} from "@/features/live/values"

// echantillon capture sur un vrai serveur, avec les valeurs d'un tour en cours
const sample = {
  ...samplesEventSchema.parse(samplesEvent).samples[0],
  speed_kmh: 186.9,
  gear: 4,
  rpm: 8029,
  completed_laps: 1,
  lap_time_ms: 55_200,
  last_lap_ms: 114_812,
  best_lap_ms: 114_812,
}

describe("surimpressions de la page Live", () => {
  it("resume vitesse arrondie, tour et chrono", () => {
    expect(overlayTelemetry("online", sample)).toBe(
      "187\u00a0km/h · Tour 2 · 0:55,200"
    )
    expect(roundedSpeed("online", sample)).toBe("187")
  })

  it("n'affiche rien d'invente hors ligne ou sans echantillon", () => {
    expect(overlayTelemetry("offline", sample)).toBe("Télémétrie n.d.")
    expect(overlayTelemetry("online", undefined)).toBe("Télémétrie n.d.")
    expect(roundedSpeed("offline", sample)).toBe("n.d.")
  })

  it("donne les valeurs de la vue en grand, delta n.d. sans historique des tours", () => {
    const stats = liveStats(
      "online",
      { ...sample, gear: -1 },
      { withSpeed: true }
    )
    expect(stats.map((s) => s.label)).toEqual([
      "Vitesse",
      "Rapport · tr/min",
      "Tour 2 · temps actuel",
      "Tour précédent",
      "Meilleur tour",
      "Delta",
    ])
    expect(stats[1].value).toBe("R · 8\u202f029")
    expect(stats.at(-1)).toEqual({ label: "Delta", value: "n.d.", muted: true })
  })

  it("garde le dernier et le meilleur tour hors ligne", () => {
    const stats = liveStats("offline", sample, { withSpeed: false })
    expect(stats.find((s) => s.label === "Meilleur tour")?.value).toBe(
      "1:54,812"
    )
    expect(stats.find((s) => s.label === "Rapport · tr/min")?.muted).toBe(true)
  })
})

describe("flux video", () => {
  it("montre le chargement a la premiere connexion", () => {
    expect(videoOverlay("online", { kind: "connecting" })).toEqual({
      kind: "loading",
      text: "Connexion au flux…",
    })
  })

  it("montre l'etat du flux absent ou en erreur, jamais une image a la place", () => {
    expect(
      videoOverlay("online", { kind: "error", reason: "aucun flux publié" })
    ).toEqual({
      kind: "unavailable",
      text: "Flux indisponible : aucun flux publié",
    })
    // l'erreur l'emporte sur la pause
    expect(
      videoOverlay("paused", { kind: "error", reason: "MediaMTX injoignable" })
        ?.kind
    ).toBe("unavailable")
  })

  it("laisse voir l'image de l'apercu ou du direct, rien sans serveur video", () => {
    expect(videoOverlay("online", { kind: "snapshot", at: 0 })).toBeNull()
    expect(videoOverlay("online", { kind: "playing" })).toBeNull()
    expect(videoOverlay("online", { kind: "unconfigured" })?.text).toBe(
      "Flux indisponible : serveur vidéo non configuré"
    )
  })

  it("montre le flux d'un poste sans telemetrie (hors ligne) quand OBS diffuse", () => {
    expect(videoOverlay("offline", { kind: "playing" })).toBeNull()
    expect(videoOverlay("offline", { kind: "snapshot", at: 0 })).toBeNull()
    expect(videoOverlay("offline", { kind: "connecting" })?.kind).toBe(
      "loading"
    )
    // sans flux non plus : la vraie raison, pas "poste hors ligne"
    expect(
      videoOverlay("offline", { kind: "error", reason: "aucun flux publié" })
        ?.text
    ).toBe("Flux indisponible : aucun flux publié")
  })

  it("ne pose rien sur le flux quand le jeu est en pause (voile desactive)", () => {
    expect(SHOW_PAUSED_OVERLAY).toBe(false)
    expect(videoOverlay("paused", { kind: "playing" })).toBeNull()
    expect(videoOverlay("paused", { kind: "snapshot", at: 0 })).toBeNull()
    // un flux absent reste signale, pause ou non
    expect(
      videoOverlay("paused", { kind: "error", reason: "aucun flux publié" })
        ?.kind
    ).toBe("unavailable")
  })
})
