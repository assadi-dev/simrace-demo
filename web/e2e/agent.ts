import type { APIRequestContext } from "@playwright/test"

import { API_URL } from "./env.ts"

/** Identifiant unique par test : le serveur garde les postes en memoire entre les tests. */
export const uniqueId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export type Overrides = Record<string, number | boolean | string[] | number[]>

/** Un echantillon valide au sens du contrat (server/app/shared/contract.py). */
function sample(tMs: number, overrides: Overrides) {
  return {
    t_ms: tMs,
    packet_id: tMs,
    speed_kmh: 180,
    gas: 0.8,
    brake: 0,
    gear: 4,
    rpm: 6500,
    steer: 0,
    status: 2,
    completed_laps: 0,
    lap_time_ms: 30_000,
    last_lap_ms: 0,
    best_lap_ms: 0,
    sector: 0,
    in_pit: false,
    track_pos: 0.25,
    ...overrides,
  }
}

export type FakeStation = {
  stationId: string
  track: string
  driver: string
  car?: string
  machine?: string
}

/**
 * Joue le role de l'agent : envoie des lots numeres a POST /ingest/batches.
 * `seq` repart de 1 pour chaque instance (un nouveau `run_id` = un agent redemarre).
 */
export class FakeAgent {
  private seq = 0
  private clockMs = Date.now()
  private readonly runId = uniqueId("run")
  private readonly request: APIRequestContext
  private readonly station: FakeStation

  constructor(request: APIRequestContext, station: FakeStation) {
    this.request = request
    this.station = station
  }

  async sendBatch(overrides: Overrides = {}, count = 5) {
    return this.sendSamples(Array.from({ length: count }, () => overrides))
  }

  /** Un lot ou chaque echantillon a ses propres valeurs (un tour qui avance, par exemple). */
  async sendSamples(list: Overrides[]) {
    this.seq += 1
    const samples = list.map((overrides) => {
      this.clockMs += 17
      return sample(this.clockMs, overrides)
    })
    const response = await this.request.post(`${API_URL}/ingest/batches`, {
      data: {
        station_id: this.station.stationId,
        machine: this.station.machine ?? "PC-E2E",
        run_id: this.runId,
        seq: this.seq,
        session: {
          track: this.station.track,
          car: this.station.car ?? "ferrari_296_gt3",
          driver: this.station.driver,
        },
        samples,
      },
    })
    if (!response.ok()) {
      throw new Error(
        `lot refuse (${response.status()}) : ${await response.text()}`
      )
    }
    return response.json() as Promise<{
      status: string
      accepted: number
      rejected: number
    }>
  }
}
