import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import type { Station } from "@/contracts/stations"
import { stationsQueryOptions } from "@/features/stations/queries"
import { sortStations } from "@/features/stations/summary"
import { useLiveStore, type LiveStation } from "@/stores/live-store"

/** Un poste vu par la page Live : sa ligne de GET /stations et son etat du flux /stream. */
export type LiveFeedEntry = {
  station: Station
  /** Absent tant que le flux n'a apporte aucun echantillon de ce poste. */
  live: LiveStation | undefined
}

/**
 * Postes de la page Live, en ligne d'abord : GET /stations (toutes les 2 s) pour la liste, le
 * nom du PC et l'etat en ligne, le store du direct (/stream) pour le dernier echantillon.
 * `query` sert aux etats de chargement et d'erreur.
 */
export function useLiveFeed() {
  const query = useQuery(stationsQueryOptions)
  const live = useLiveStore((state) => state.stations)

  const feed = useMemo<LiveFeedEntry[]>(
    () =>
      query.data
        ? sortStations(query.data).map((station) => ({
            station,
            live: live[station.station_id],
          }))
        : [],
    [query.data, live]
  )

  return { feed, query }
}
