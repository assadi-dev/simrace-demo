import { useEffect, useMemo } from "react"
import { create } from "zustand"

import { sortStations } from "@/features/stations/summary"
import {
  createMockFeed,
  tickMockFeed,
  type LiveFeedEntry,
} from "@/features/live/mock"

/** Rythme des lots de l'agent : un toutes les 200 ms par poste. */
const BATCH_MS = 200

/** Demo partagee par la mosaique, la vue en grand et le plein ecran (pas de remise a zero). */
const useMockFeed = create<{
  feed: LiveFeedEntry[]
  tick: (now: number) => void
}>()((set) => ({
  feed: createMockFeed(Date.now()),
  tick: (now) => set((s) => ({ feed: tickMockFeed(s.feed, BATCH_MS, now) })),
}))

let readers = 0
let timer: ReturnType<typeof setInterval> | undefined

/**
 * Postes de la page Live et leur dernier echantillon, en ligne d'abord. Pour l'instant, donnees
 * de demo au format du serveur (mock.ts), qui avancent d'un lot toutes les 200 ms tant qu'un
 * ecran Live est ouvert. Pour brancher le vrai serveur : `useQuery(stationsQueryOptions)` et
 * `useLiveStore((s) => s.stations)`, meme forme.
 */
export function useLiveFeed(): LiveFeedEntry[] {
  const feed = useMockFeed((s) => s.feed)

  useEffect(() => {
    readers += 1
    if (readers === 1) {
      timer = setInterval(
        () => useMockFeed.getState().tick(Date.now()),
        BATCH_MS
      )
    }
    return () => {
      readers -= 1
      if (readers === 0) clearInterval(timer)
    }
  }, [])

  return useMemo(() => {
    const byId = new Map(feed.map((e) => [e.station.station_id, e]))
    return sortStations(feed.map((e) => e.station)).flatMap(
      (s) => byId.get(s.station_id) ?? []
    )
  }, [feed])
}
