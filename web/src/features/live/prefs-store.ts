import { create } from "zustand"

import type { Protocol } from "@/features/live/media"

/** Volume repris quand on reactive le son apres l'avoir baisse a zero. */
const RESTORED_VOLUME = 0.5

type LivePrefs = {
  protocol: Protocol
  /** Son coupe par defaut : plusieurs lecteurs demarrent sans action de l'utilisateur. */
  muted: boolean
  /** Volume du lecteur, de 0 a 1 (garde quand le son est coupe). */
  volume: number
  setProtocol: (protocol: Protocol) => void
  toggleMuted: () => void
  /** Volume choisi au curseur : 0 coupe le son, une autre valeur le reactive. */
  setVolume: (volume: number) => void
}

/** Choix de lecture partages par la mosaique, la vue en grand et le plein ecran. */
export const useLivePrefs = create<LivePrefs>()((set) => ({
  protocol: "webrtc",
  muted: true,
  volume: 1,
  setProtocol: (protocol) => set({ protocol }),
  toggleMuted: () =>
    set((state) =>
      state.muted && state.volume === 0
        ? { muted: false, volume: RESTORED_VOLUME }
        : { muted: !state.muted }
    ),
  setVolume: (volume) => set({ volume, muted: volume === 0 }),
}))
