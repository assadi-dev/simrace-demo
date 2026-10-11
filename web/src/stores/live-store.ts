import { create } from "zustand"

import type { Sample, SamplesEvent, SessionInfo } from "@/contracts/telemetry"
import { channelsOf, clearAllChannels } from "@/features/direct/channels"
import {
  advanceHistory,
  EMPTY_HISTORY,
  resetTrip,
  type StationHistory,
} from "@/features/direct/history"

export type Connection = "connecting" | "connected" | "reconnecting" | "offline"

/** Dernier etat connu d'un poste, deduit du flux SSE. */
export type LiveStation = {
  session: SessionInfo
  latest: Sample
  /** Tours, drapeaux et penalites, distance : deduits du flux depuis l'ouverture de la page. */
  history: StationHistory
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
  /** Remet a zero la distance et la vitesse moyenne d'un poste. */
  resetTrip: (stationId: string) => void
  reset: () => void
}

const initialState = {
  connection: "connecting" as Connection,
  stations: {} as Record<string, LiveStation>,
  invalidEvents: 0,
}

/**
 * Etat du direct : la connexion, le dernier echantillon et l'historique de chaque poste.
 * Les tampons des courbes (features/direct/channels.ts) sont remplis ici mais vivent hors de
 * l'etat React.
 */
export const useLiveStore = create<LiveState>()((set) => ({
  ...initialState,

  setConnection: (connection) => set({ connection }),

  pushSamples: (event, receivedAt = Date.now()) =>
    set((state) => {
      const current = state.stations[event.station_id]
      let latest = current?.latest
      let history = current?.history ?? EMPTY_HISTORY
      for (const sample of event.samples) {
        // Un t_ms qui recule (ou se repete) est ignore : le serveur ne reordonne pas.
        if (latest && sample.t_ms <= latest.t_ms) continue
        history = advanceHistory(history, latest, sample)
        channelsOf(event.station_id).push(sample)
        latest = sample
      }
      if (!latest || latest === current?.latest) return state
      return {
        stations: {
          ...state.stations,
          [event.station_id]: {
            session: event.session,
            latest,
            history,
            receivedAt,
          },
        },
      }
    }),

  countInvalidEvent: () =>
    set((state) => ({ invalidEvents: state.invalidEvents + 1 })),

  resetTrip: (stationId) =>
    set((state) => {
      const current = state.stations[stationId]
      if (!current) return state
      return {
        stations: {
          ...state.stations,
          [stationId]: { ...current, history: resetTrip(current.history) },
        },
      }
    }),

  reset: () => {
    clearAllChannels()
    set(initialState)
  },
}))
