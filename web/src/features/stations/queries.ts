import { queryOptions } from "@tanstack/react-query"

import { fetchStations } from "@/lib/api"

/** GET /stations, interroge toutes les 2 s (compteurs d'integrite, pilote, voiture, circuit). */
export const stationsQueryOptions = queryOptions({
  queryKey: ["stations"],
  queryFn: ({ signal }) => fetchStations(signal),
  refetchInterval: 2000,
})
