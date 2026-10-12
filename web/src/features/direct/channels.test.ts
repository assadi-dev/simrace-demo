import { describe, expect, it } from "vitest"

import samplesEvent from "@/contracts/fixtures/samples-event.json"
import { samplesEventSchema, type Sample } from "@/contracts/telemetry"
import { CHANNEL_SECONDS, ChannelBuffer } from "./channels"

const base = samplesEventSchema.parse(samplesEvent).samples[0]
const sample = (t_ms: number, overrides: Partial<Sample> = {}): Sample => ({
  ...base,
  t_ms,
  status: 2,
  ...overrides,
})

describe("ChannelBuffer", () => {
  it("rend les points de la fenetre, x en secondes avant le dernier, pedales en %", () => {
    const buffer = new ChannelBuffer()
    buffer.push(sample(0, { speed_kmh: 100, gas: 0.5, brake: 0 }))
    buffer.push(sample(500, { speed_kmh: 120, gas: 1, brake: 0.25 }))

    expect(buffer.snapshot(10)).toEqual({
      x: [-0.5, 0],
      speed: [100, 120],
      gas: [50, 100],
      brake: [0, 25],
    })
    expect(buffer.snapshot(0.2).x).toEqual([0])
  })

  it("ignore la pause et un t_ms qui recule", () => {
    const buffer = new ChannelBuffer()
    buffer.push(sample(1000))
    buffer.push(sample(1017, { status: 3 }))
    buffer.push(sample(900))

    expect(buffer.size).toBe(1)
  })

  it("coupe la ligne apres un trou (point vide)", () => {
    const buffer = new ChannelBuffer()
    buffer.push(sample(0, { speed_kmh: 100 }))
    buffer.push(sample(5_000, { speed_kmh: 100 }))

    expect(buffer.snapshot(10).speed).toEqual([100, null, 100])
  })

  it("ne garde que les 60 dernieres secondes a 60 Hz (tampon circulaire)", () => {
    const buffer = new ChannelBuffer()
    const count = CHANNEL_SECONDS * 60 + 100
    for (let i = 0; i < count; i++)
      buffer.push(sample(i * 16, { speed_kmh: i % 300 }))

    expect(buffer.size).toBe(CHANNEL_SECONDS * 60)
    const { speed } = buffer.snapshot(CHANNEL_SECONDS)
    expect(speed.at(-1)).toBe((count - 1) % 300)
  })
})
