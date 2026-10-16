import { z } from "zod"

/*
 * GET /tracks/{circuit}/reference : miroir de TrackMapOut (server/app/features/tracks/schemas.py).
 * points[i] = [x, z] en metres, a la position i / points.length le long du tour.
 */
export const trackMapSchema = z.object({
  lap_id: z.string(),
  track: z.string(),
  station_id: z.string(),
  car: z.string(),
  lap_number: z.int(),
  lap_time_ms: z.int(),
  recorded_at: z.coerce.date(),
  length_m: z.number(),
  points: z.array(z.tuple([z.number(), z.number()])).min(2),
  strategy: z.string(),
})
export type TrackMap = z.infer<typeof trackMapSchema>
