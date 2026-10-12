import { create } from "zustand"

import type { Protocol } from "@/features/live/media"

type LivePrefs = {
  protocol: Protocol
  /** Son coupe par defaut : plusieurs lecteurs demarrent sans action de l'utilisateur. */
  muted: boolean
  setProtocol: (protocol: Protocol) => void
  toggleMuted: () => void
}

/** Choix de lecture partages par la mosaique, la vue en grand et le plein ecran. */
export const useLivePrefs = create<LivePrefs>()((set) => ({
  protocol: "webrtc",
  muted: true,
  setProtocol: (protocol) => set({ protocol }),
  toggleMuted: () => set((state) => ({ muted: !state.muted })),
}))
