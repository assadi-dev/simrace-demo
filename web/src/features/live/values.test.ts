import { describe, expect, it } from "vitest"

import { createMockFeed } from "@/features/live/mock"
import { hlsUrl, whepUrl } from "@/features/live/media"
import {
  liveStats,
  overlayTelemetry,
  roundedSpeed,
  videoLabel,
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

  it("decrit l'etat de la lecture dans la pastille du protocole", () => {
    expect(videoLabel("WebRTC", { kind: "playing" })).toBe(
      "WebRTC · latence n.d."
    )
    expect(videoLabel("WebRTC", { kind: "demo" })).toBe(
      "WebRTC · image de démo"
    )
    expect(
      videoLabel("HLS", { kind: "error", reason: "aucun flux publié" })
    ).toBe("HLS · aucun flux publié")
  })
})
