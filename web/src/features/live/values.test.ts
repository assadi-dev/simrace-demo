import { describe, expect, it } from "vitest"

import { createMockFeed } from "@/features/live/mock"
import { hlsUrl, whepUrl } from "@/features/live/media"
import {
  liveStats,
  overlayTelemetry,
  roundedSpeed,
  videoOverlay,
} from "@/features/live/values"

const sample = createMockFeed(Date.UTC(2026, 9, 12, 18)).find(
  (e) => e.station.station_id === "sim-1"
)!.live!.latest

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
  it("vise live/<poste> sur les ports de la decision 0019", () => {
    expect(whepUrl("10.192.2.241", "sim-1")).toBe(
      "http://10.192.2.241:8889/live/sim-1/whep"
    )
    expect(hlsUrl("10.192.2.241", "sim-1")).toBe(
      "http://10.192.2.241:8888/live/sim-1/index.m3u8"
    )
  })

  it("montre le chargement a la premiere connexion", () => {
    expect(videoOverlay("online", { kind: "connecting" }, true)).toEqual({
      kind: "loading",
      text: "Connexion au flux…",
    })
  })

  it("montre l'etat du flux absent ou en erreur, jamais une image a la place", () => {
    expect(
      videoOverlay(
        "online",
        { kind: "error", reason: "aucun flux publié" },
        true
      )
    ).toEqual({
      kind: "unavailable",
      text: "Flux indisponible : aucun flux publié",
    })
    expect(videoOverlay("offline", { kind: "off" }, true)?.text).toBe(
      "Flux indisponible : poste hors ligne"
    )
    // l'erreur l'emporte sur la pause
    expect(
      videoOverlay(
        "paused",
        { kind: "error", reason: "MediaMTX injoignable" },
        true
      )?.kind
    ).toBe("unavailable")
  })

  it("laisse voir l'image : apercu, direct, ou affiche en demo", () => {
    expect(
      videoOverlay("online", { kind: "snapshot", at: 0 }, false)
    ).toBeNull()
    expect(videoOverlay("online", { kind: "playing" }, false)).toBeNull()
    expect(videoOverlay("online", { kind: "demo" }, true)).toBeNull()
    expect(videoOverlay("online", { kind: "demo" }, false)?.kind).toBe(
      "unavailable"
    )
    expect(
      videoOverlay("paused", { kind: "snapshot", at: 0 }, false)?.kind
    ).toBe("paused")
  })
})
