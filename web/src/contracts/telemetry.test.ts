import { describe, expect, it } from "vitest"

import samplesEvent from "./fixtures/samples-event.json"
import { sampleSchema, samplesEventSchema } from "./telemetry"

// samples-event.json est un vrai evenement SSE `samples` capture sur le serveur
// (GET /stream), reduit a deux echantillons. Le regenerer si le contrat serveur change.
const rawSample = samplesEvent.samples[0]

describe("contrat de telemetrie", () => {
  it("accepte un evenement reel du serveur, champs optionnels a null", () => {
    const parsed = samplesEventSchema.parse(samplesEvent)

    expect(parsed.station_id).toBe(samplesEvent.station_id)
    expect(parsed.samples).toHaveLength(2)
    expect(parsed.samples[0].x).toBeNull()
  })

  it("declare exactement les champs envoyes par le serveur", () => {
    // Zod ignore sans bruit les champs inconnus : sans ce test, un champ ajoute
    // cote serveur (server/app/shared/contract.py) disparaitrait en silence.
    expect(Object.keys(sampleSchema.shape).sort()).toEqual(
      Object.keys(rawSample).sort()
    )
  })

  it("rejette un echantillon hors des bornes du serveur", () => {
    expect(sampleSchema.safeParse({ ...rawSample, speed_kmh: 501 }).success).toBe(false)
    expect(sampleSchema.safeParse({ ...rawSample, gas: -0.1 }).success).toBe(false)
    expect(sampleSchema.safeParse({ ...rawSample, status: 4 }).success).toBe(false)
  })

  it("rejette un champ obligatoire absent ou d'un mauvais type", () => {
    const withoutRpm = Object.fromEntries(
      Object.entries(rawSample).filter(([key]) => key !== "rpm")
    )
    expect(sampleSchema.safeParse(withoutRpm).success).toBe(false)
    expect(sampleSchema.safeParse({ ...rawSample, in_pit: "non" }).success).toBe(false)
  })

  it("exige quatre mesures par roue", () => {
    const threeWheels = { ...rawSample, tyre_temp_c: [80, 81, 82] }
    const fourWheels = { ...rawSample, tyre_temp_c: [80, 81, 82, 83] }

    expect(sampleSchema.safeParse(threeWheels).success).toBe(false)
    expect(sampleSchema.safeParse(fourWheels).success).toBe(true)
  })

  it("rejette un drapeau de piste inconnu", () => {
    expect(
      sampleSchema.safeParse({ ...rawSample, track_flags: ["green", "pink"] }).success
    ).toBe(false)
    expect(
      sampleSchema.safeParse({ ...rawSample, track_flags: ["green", "yellow_s3"] }).success
    ).toBe(true)
  })
})
