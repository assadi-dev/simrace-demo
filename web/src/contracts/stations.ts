import { z } from "zod"

import { sessionInfoSchema } from "@/contracts/telemetry"

/*
 * GET /stations et GET /stations/{id} : miroir de StationOut
 * (server/app/features/stations/schemas.py).
 */
export const stationSchema = z.object({
  station_id: z.string(),
  machine: z.string().nullable(),
  run_id: z.string(),
  online: z.boolean(),
  last_seen: z.coerce.date().nullable(),
  session: sessionInfoSchema,
  last_seq: z.int(),
  batches: z.int(),
  samples: z.int(),
  rejected: z.int(),
  duplicates: z.int(),
  gaps: z.int(),
  /** "champ:type" -> nombre de rejets */
  reject_reasons: z.record(z.string(), z.int()),
})
export type Station = z.infer<typeof stationSchema>

export const stationListSchema = z.array(stationSchema)
