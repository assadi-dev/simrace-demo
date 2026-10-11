import { create } from "zustand"

import type { Sample, SamplesEvent, SessionInfo } from "@/contracts/telemetry"

export type Connection = "connecting" | "connected" | "reconnecting" | "offline"

/** Dernier etat connu d'un poste, deduit du flux SSE. */
export type LiveStation = {
  session: SessionInfo
  latest: Sample
  /** Horloge du navigateur a la reception du dernier echantillon retenu. */
  receivedAt: number
}

type LiveState = {
  connection: Connection
  stations: Record<string, LiveStation>
  /** Evenements du flux ignores car hors contrat (JSON ou schema invalide). */
  invalidEvents: number
  setConnection: (connection: Connection) => void
  pushSamples: (event: SamplesEvent, receivedAt?: number) => void
  countInvalidEvent: () => void
  reset: () => void
}

const initialState = {
  connection: "connecting" as Connection,
  stations: {} as Record<string, LiveStation>,
  invalidEvents: 0,
}

/**
 * Etat du direct. Pour l'instant : la connexion et le dernier echantillon de chaque poste.
 * Les tampons de courbes (60 s a 60 Hz) viendront avec l'ecran Direct, hors de l'etat React.
 */
export const useLiveStore = create<LiveState>()((set) => ({
  ...initialState,

  setConnection: (connection) => set({ connection }),

  pushSamples: (event, receivedAt = Date.now()) =>
    set((state) => {
      const current = state.stations[event.station_id]
      let latest = current?.latest
      for (const sample of event.samples) {
        // Un t_ms qui recule (ou se repete) est ignore : le serveur ne reordonne pas.
        if (!latest || sample.t_ms > latest.t_ms) latest = sample
      }
      if (!latest || latest === current?.latest) return state
      return {
        stations: {
          ...state.stations,
          [event.station_id]: { session: event.session, latest, receivedAt },
        },
      }
    }),

  countInvalidEvent: () =>
    set((state) => ({ invalidEvents: state.invalidEvents + 1 })),

  reset: () => set(initialState),
}))
