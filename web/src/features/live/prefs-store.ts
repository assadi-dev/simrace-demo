import { create } from "zustand"

import type { Protocol } from "@/features/live/media"

/**
 * Volume par defaut (30 %), repris aussi quand on reactive le son apres l'avoir baisse a zero.
 * Son actif par defaut : si le navigateur refuse la lecture avec son (aucune interaction avec
 * la page), le lecteur coupe le son pour demarrer quand meme (use-station-video.ts).
 */
export const DEFAULT_VOLUME = 0.3

type LivePrefs = {
  protocol: Protocol
  /** Son coupe. Les apercus de la mosaique sont toujours muets, quel que soit ce choix. */
  muted: boolean
  /** Volume du lecteur, de 0 a 1 (garde quand le son est coupe). */
  volume: number
  setProtocol: (protocol: Protocol) => void
  toggleMuted: () => void
  setMuted: (muted: boolean) => void
  /** Volume choisi au curseur : 0 coupe le son, une autre valeur le reactive. */
  setVolume: (volume: number) => void
}

/** Choix de lecture partages par la mosaique, la vue en grand et le plein ecran. */
export const useLivePrefs = create<LivePrefs>()((set) => ({
  protocol: "webrtc",
  muted: false,
  volume: DEFAULT_VOLUME,
  setProtocol: (protocol) => set({ protocol }),
  toggleMuted: () =>
    set((state) =>
      state.muted && state.volume === 0
        ? { muted: false, volume: DEFAULT_VOLUME }
        : { muted: !state.muted }
    ),
  setMuted: (muted) => set({ muted }),
  setVolume: (volume) => set({ volume, muted: volume === 0 }),
}))
