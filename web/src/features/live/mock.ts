import { stationListSchema, type Station } from "@/contracts/stations"
import {
  ACC_STATUS,
  samplesEventSchema,
  type Sample,
  type SessionInfo,
} from "@/contracts/telemetry"

import monzaPoster from "./posters/monza.webp"
import nurburgringPoster from "./posters/nurburgring.webp"
import pitPoster from "./posters/pit.webp"

/*
 * Donnees de demo de la page Live, en attendant que le serveur expose les flux video
 * (maquette 5, notes). Meme forme que le serveur : GET /stations (JSON brut, dates ISO) et
 * evenements `samples` de /stream, valides par les memes schemas Zod que les vraies reponses.
 * Memes postes que les maquettes : deux en ligne, un en pause, un hors ligne.
 */

/** Etat d'un poste vu par la page Live : sa ligne de GET /stations et son dernier echantillon. */
export type LiveFeedEntry = {
  station: Station
  live: { session: SessionInfo; latest: Sample; receivedAt: number } | undefined
}

/** Champs optionnels du contrat : le serveur les renvoie a `null` quand l'agent ne les lit pas. */
const UNREAD = {
  x: null,
  z: null,
  tyre_pressure_psi: null,
  tyre_temp_c: null,
  brake_temp_c: null,
  pad_life_mm: null,
  disc_life_mm: null,
  fuel_l: null,
  fuel_per_lap_l: null,
  tc_level: null,
  abs_level: null,
  g_lat: null,
  g_vert: null,
  g_long: null,
  flag: null,
  penalty_code: null,
  penalty_time_s: null,
  tc_cut_level: null,
  engine_map: null,
  brake_bias: null,
  is_valid_lap: null,
  fuel_estimated_laps: null,
  track_flags: null,
  air_temp_c: null,
  road_temp_c: null,
}

type MockStation = {
  station_id: string
  machine: string
  session: SessionInfo
  /** Anciennete du dernier lot (ms) : au-dela de 5 s, le serveur dit le poste hors ligne. */
  silentMs: number
  batches: number
  sample: Record<string, unknown>
}

const MOCK_STATIONS: MockStation[] = [
  {
    station_id: "sim-1",
    machine: "PC-SIM-01",
    session: {
      track: "nurburgring",
      car: "porsche_991ii_gt3_r",
      driver: "Alice Martin",
      fuel_capacity_l: 120,
    },
    silentMs: 0,
    batches: 1840,
    sample: {
      speed_kmh: 186.9,
      gas: 1,
      brake: 0,
      gear: 4,
      rpm: 8029,
      steer: 0.04,
      status: ACC_STATUS.live,
      completed_laps: 1,
      lap_time_ms: 55_200,
      last_lap_ms: 114_812,
      best_lap_ms: 114_812,
      sector: 1,
      in_pit: false,
      track_pos: 0.48,
      air_temp_c: 18.2,
      road_temp_c: 24.6,
    },
  },
  {
    station_id: "sim-2",
    machine: "PC-SIM-02",
    session: {
      track: "monza",
      car: "ferrari_296_gt3",
      driver: "Bruno Lefèvre",
      fuel_capacity_l: 104,
    },
    silentMs: 0,
    batches: 2715,
    sample: {
      speed_kmh: 142.3,
      gas: 0.72,
      brake: 0,
      gear: 3,
      rpm: 7120,
      steer: -0.12,
      status: ACC_STATUS.live,
      completed_laps: 4,
      lap_time_ms: 76_680,
      last_lap_ms: 108_215,
      best_lap_ms: 107_902,
      sector: 2,
      in_pit: false,
      track_pos: 0.71,
      air_temp_c: 26.4,
      road_temp_c: 38.1,
    },
  },
  {
    station_id: "sim-3",
    machine: "DESKTOP-4F2K",
    session: {
      track: "nurburgring",
      car: "bmw_m4_gt3",
      driver: "Chloé Durand",
      fuel_capacity_l: 120,
    },
    silentMs: 0,
    batches: 310,
    sample: {
      speed_kmh: 0,
      gas: 0,
      brake: 0,
      gear: 1,
      rpm: 1150,
      steer: 0,
      status: ACC_STATUS.pause,
      completed_laps: 0,
      lap_time_ms: 3405,
      last_lap_ms: 0,
      best_lap_ms: 0,
      sector: 0,
      in_pit: true,
      track_pos: 0.03,
    },
  },
  {
    station_id: "sim-4",
    machine: "PC-SIM-04",
    session: {
      track: "misano",
      car: "audi_r8_lms_evo_ii",
      driver: "David Moreau",
      fuel_capacity_l: 120,
    },
    silentMs: 3 * 60_000,
    batches: 1204,
    sample: {
      speed_kmh: 96.4,
      gas: 0.4,
      brake: 0.2,
      gear: 3,
      rpm: 6010,
      steer: 0.3,
      status: ACC_STATUS.live,
      completed_laps: 6,
      lap_time_ms: 40_110,
      last_lap_ms: 101_902,
      best_lap_ms: 101_902,
      sector: 1,
      in_pit: false,
      track_pos: 0.39,
    },
  },
]

/** Image fixe affichee tant qu'aucun flux video n'est lu (placeholder genere, pas une capture). */
export const MOCK_POSTERS: Record<string, string> = {
  "sim-1": nurburgringPoster,
  "sim-2": monzaPoster,
  "sim-3": pitPoster,
}

/** GET /stations tel que le serveur le renvoie. */
export function mockStationsJson(now: number): unknown[] {
  return MOCK_STATIONS.map((s) => ({
    station_id: s.station_id,
    machine: s.machine,
    run_id: `demo-${s.station_id}`,
    online: s.silentMs < 5000,
    last_seen: new Date(now - s.silentMs).toISOString(),
    session: s.session,
    last_seq: s.batches,
    batches: s.batches,
    samples: s.batches * 12,
    rejected: 0,
    duplicates: 0,
    gaps: 0,
    reject_reasons: {},
  }))
}

/** Dernier evenement `samples` de /stream pour chaque poste, tel que le serveur l'envoie. */
export function mockSamplesEventsJson(now: number): unknown[] {
  return MOCK_STATIONS.map((s, index) => ({
    station_id: s.station_id,
    session: s.session,
    samples: [
      {
        ...UNREAD,
        t_ms: now - s.silentMs,
        packet_id: 4000 + index * 1000,
        ...s.sample,
      },
    ],
  }))
}

/** Etat initial de la demo, valide par les schemas du contrat (comme une vraie reponse). */
export function createMockFeed(now: number): LiveFeedEntry[] {
  const stations = stationListSchema.parse(mockStationsJson(now))
  const events = mockSamplesEventsJson(now).map((json) =>
    samplesEventSchema.parse(json)
  )
  return stations.map((station) => {
    const event = events.find((e) => e.station_id === station.station_id)
    const latest = event?.samples.at(-1)
    return {
      station,
      live:
        event && latest
          ? { session: event.session, latest, receivedAt: latest.t_ms }
          : undefined,
    }
  })
}

/** Duree d'un tour simule quand ACC n'en a pas encore donne (ms). */
const DEFAULT_LAP_MS = 120_000

/**
 * Fait rouler un echantillon de demo de `dtMs` : temps du tour, position, tour termine, vitesse
 * et rapport. Seul un poste en roulage (statut live) avance ; un poste en pause reste fige.
 */
export function advanceMockSample(sample: Sample, dtMs: number): Sample {
  if (sample.status !== ACC_STATUS.live) return sample
  const lapMs = sample.best_lap_ms || DEFAULT_LAP_MS
  let lapTimeMs = sample.lap_time_ms + dtMs
  let completedLaps = sample.completed_laps
  let lastLapMs = sample.last_lap_ms
  if (lapTimeMs >= lapMs) {
    lapTimeMs -= lapMs
    completedLaps += 1
    lastLapMs = lapMs
  }
  const trackPos = lapTimeMs / lapMs
  // cinq freinages par tour : la vitesse oscille entre 80 et 240 km/h
  const speed = 160 + 80 * Math.sin(trackPos * 2 * Math.PI * 5)
  const gear = Math.min(6, 1 + Math.floor(speed / 45))
  return {
    ...sample,
    t_ms: sample.t_ms + dtMs,
    packet_id: sample.packet_id + Math.round(dtMs / (1000 / 60)),
    speed_kmh: Math.round(speed * 10) / 10,
    gear,
    rpm: Math.round(5000 + ((speed % 45) / 45) * 3500),
    completed_laps: completedLaps,
    lap_time_ms: lapTimeMs,
    last_lap_ms: lastLapMs,
    track_pos: Math.round(trackPos * 1000) / 1000,
  }
}

/** Un lot de demo : chaque poste en ligne recoit un echantillon de plus, recu a `now`. */
export function tickMockFeed(
  feed: readonly LiveFeedEntry[],
  dtMs: number,
  now: number
): LiveFeedEntry[] {
  return feed.map((entry) => {
    if (!entry.station.online || !entry.live) return entry
    return {
      station: { ...entry.station, last_seen: new Date(now) },
      live: {
        ...entry.live,
        latest: advanceMockSample(entry.live.latest, dtMs),
        receivedAt: now,
      },
    }
  })
}
