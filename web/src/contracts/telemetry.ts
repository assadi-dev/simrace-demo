import { z } from "zod"

/*
 * Contrat de telemetrie : miroir de server/app/shared/contract.py (decision 0009 : pas de
 * package partage). Si le contrat serveur change, changer ce fichier et ses tests.
 * Les champs optionnels arrivent a `null` dans le flux (le serveur serialise avec model_dump),
 * d'ou `nullish()` partout.
 */

const MAX_LAP_MS = 3_600_000
const MAX_COORD_M = 100_000

export const ACC_STATUS = { off: 0, replay: 1, live: 2, pause: 3 } as const

export const TRACK_FLAGS = [
  "yellow",
  "yellow_s1",
  "yellow_s2",
  "yellow_s3",
  "white",
  "green",
  "chequered",
  "red",
] as const
export type TrackFlag = (typeof TRACK_FLAGS)[number]

/** Quatre mesures : avant gauche, avant droit, arriere gauche, arriere droit. */
const perWheel = (min: number, max: number) => {
  const value = z.number().min(min).max(max)
  return z.tuple([value, value, value, value])
}

export const sessionInfoSchema = z.object({
  track: z.string().max(64),
  car: z.string().max(64),
  driver: z.string().max(128),
  fuel_capacity_l: z.number().min(0).max(1000).nullish(),
  // jeu lu par l'agent et sa version (decision 0022) ; null pour un ancien agent
  game: z
    .string()
    .regex(/^[a-z0-9_-]{1,16}$/)
    .nullish(),
  game_version: z.string().max(15).nullish(),
})
export type SessionInfo = z.infer<typeof sessionInfoSchema>

export const sampleSchema = z.object({
  t_ms: z.int().min(0),
  packet_id: z.int().min(0),
  speed_kmh: z.number().min(0).max(500),
  gas: z.number().min(0).max(1),
  brake: z.number().min(0).max(1),
  gear: z.int().min(-1).max(9),
  rpm: z.int().min(0).max(20_000),
  steer: z.number().min(-10).max(10),
  status: z.int().min(0).max(3),
  completed_laps: z.int().min(0),
  lap_time_ms: z.int().min(0).max(MAX_LAP_MS),
  last_lap_ms: z.int().min(0).max(MAX_LAP_MS),
  best_lap_ms: z.int().min(0).max(MAX_LAP_MS),
  sector: z.int().min(0).max(9),
  in_pit: z.boolean(),
  track_pos: z.number().min(0).max(1),
  // position monde en metres (decision 0011)
  x: z.number().min(-MAX_COORD_M).max(MAX_COORD_M).nullish(),
  z: z.number().min(-MAX_COORD_M).max(MAX_COORD_M).nullish(),
  // pneus et freins (decision 0013)
  tyre_pressure_psi: perWheel(0, 100).nullish(),
  tyre_temp_c: perWheel(-50, 500).nullish(),
  brake_temp_c: perWheel(-50, 2000).nullish(),
  pad_life_mm: perWheel(0, 100).nullish(),
  disc_life_mm: perWheel(0, 100).nullish(),
  // carburant et aides (decision 0014)
  fuel_l: z.number().min(0).max(1000).nullish(),
  fuel_per_lap_l: z.number().min(0).max(100).nullish(),
  tc_level: z.int().min(0).max(30).nullish(),
  abs_level: z.int().min(0).max(30).nullish(),
  // forces G (decision 0015)
  g_lat: z.number().min(-20).max(20).nullish(),
  g_vert: z.number().min(-20).max(20).nullish(),
  g_long: z.number().min(-20).max(20).nullish(),
  // drapeau et penalite (decision 0016)
  flag: z.int().min(0).max(20).nullish(),
  penalty_code: z.int().min(0).max(99).nullish(),
  penalty_time_s: z.number().min(0).max(3600).nullish(),
  // reglages et etat de piste (decision 0016)
  tc_cut_level: z.int().min(0).max(30).nullish(),
  engine_map: z.int().min(0).max(30).nullish(),
  brake_bias: z.number().min(0).max(100).nullish(),
  is_valid_lap: z.boolean().nullish(),
  fuel_estimated_laps: z.number().min(0).max(10_000).nullish(),
  track_flags: z.array(z.enum(TRACK_FLAGS)).max(TRACK_FLAGS.length).nullish(),
  // meteo (decision 0016)
  air_temp_c: z.number().min(-50).max(100).nullish(),
  road_temp_c: z.number().min(-50).max(150).nullish(),
  // phase de la session ecrite par le jeu, AC EVO seulement (decision 0022)
  session_phase: z.string().max(33).nullish(),
  // place au classement et adversaires en piste, 0 = seul (decision 0023)
  race_position: z.int().min(1).max(60).nullish(),
  opponents: z.int().min(0).max(59).nullish(),
})
export type Sample = z.infer<typeof sampleSchema>

/** Evenement SSE `samples` (GET /stream) : un par lot accepte. */
export const samplesEventSchema = z.object({
  station_id: z.string(),
  session: sessionInfoSchema,
  samples: z.array(sampleSchema),
})
export type SamplesEvent = z.infer<typeof samplesEventSchema>
