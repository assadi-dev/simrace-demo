import { ACC_STATUS, type Sample } from "@/contracts/telemetry"
import { MAX_STEP_MS } from "@/features/direct/history"

/*
 * Tampons des courbes : 60 s a 60 Hz par poste, hors de l'etat React (FRONT.md). Le store les
 * remplit a chaque echantillon retenu ; les courbes les lisent a 20 images par seconde.
 */

export const CHANNEL_SECONDS = 60
const CAPACITY = CHANNEL_SECONDS * 60

/** Donnees alignees pour uPlot : x en secondes avant le dernier echantillon (<= 0). */
export type ChannelSnapshot = {
  x: number[]
  speed: (number | null)[]
  gas: (number | null)[]
  brake: (number | null)[]
}

export class ChannelBuffer {
  private readonly t = new Float64Array(CAPACITY)
  private readonly speed = new Float32Array(CAPACITY)
  private readonly gas = new Float32Array(CAPACITY)
  private readonly brake = new Float32Array(CAPACITY)
  private start = 0
  private length = 0
  private lastT: number | null = null

  /**
   * Ajoute un echantillon. La pause n'ajoute rien (courbes figees). Apres un trou (lots perdus,
   * pause, coupure du flux), un point vide coupe la ligne : le trou reste visible.
   */
  push(sample: Sample): void {
    if (sample.status !== ACC_STATUS.live) return
    if (this.lastT !== null) {
      if (sample.t_ms <= this.lastT) return
      if (sample.t_ms - this.lastT > MAX_STEP_MS) {
        this.write(this.lastT + 1, NaN, NaN, NaN)
      }
    }
    // pedales en % pour l'axe commun 0..100
    this.write(
      sample.t_ms,
      sample.speed_kmh,
      sample.gas * 100,
      sample.brake * 100
    )
    this.lastT = sample.t_ms
  }

  clear(): void {
    this.start = 0
    this.length = 0
    this.lastT = null
  }

  get size(): number {
    return this.length
  }

  /** Points des `windowS` dernieres secondes, du plus ancien au plus recent. */
  snapshot(windowS: number): ChannelSnapshot {
    const out: ChannelSnapshot = { x: [], speed: [], gas: [], brake: [] }
    if (this.lastT === null) return out
    const from = this.lastT - windowS * 1000
    const value = (v: number) => (Number.isNaN(v) ? null : v)
    for (let k = 0; k < this.length; k++) {
      const i = (this.start + k) % CAPACITY
      if (this.t[i] < from) continue
      out.x.push((this.t[i] - this.lastT) / 1000)
      out.speed.push(value(this.speed[i]))
      out.gas.push(value(this.gas[i]))
      out.brake.push(value(this.brake[i]))
    }
    return out
  }

  private write(t: number, speed: number, gas: number, brake: number): void {
    const i = (this.start + this.length) % CAPACITY
    this.t[i] = t
    this.speed[i] = speed
    this.gas[i] = gas
    this.brake[i] = brake
    if (this.length < CAPACITY) this.length += 1
    else this.start = (this.start + 1) % CAPACITY
  }
}

const buffers = new Map<string, ChannelBuffer>()

/** Tampon d'un poste, cree au premier echantillon. */
export function channelsOf(stationId: string): ChannelBuffer {
  let buffer = buffers.get(stationId)
  if (!buffer) {
    buffer = new ChannelBuffer()
    buffers.set(stationId, buffer)
  }
  return buffer
}

export const clearAllChannels = () => buffers.clear()
