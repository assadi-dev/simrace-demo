import { create } from "zustand"

/**
 * Volume par defaut (30 %), repris aussi quand on reactive le son apres l'avoir baisse a zero.
 * Son actif par defaut : si le navigateur refuse la lecture avec son (aucune interaction avec
 * la page), le lecteur coupe le son pour demarrer quand meme (use-station-video.ts).
 */
export const DEFAULT_VOLUME = 0.3

type LivePrefs = {
  /** Son coupe. Les apercus de la mosaique sont toujours muets, quel que soit ce choix. */
  muted: boolean
  /** Volume du lecteur, de 0 a 1 (garde quand le son est coupe). */
  volume: number
  /** Surimpressions du plein ecran epinglees : elles ne se masquent plus d'elles-memes. */
  overlaysPinned: boolean
  toggleMuted: () => void
  setMuted: (muted: boolean) => void
  /** Volume choisi au curseur : 0 coupe le son, une autre valeur le reactive. */
  setVolume: (volume: number) => void
  toggleOverlaysPinned: () => void
}

/**
 * Choix de lecture partages par la mosaique, la vue en grand et le plein ecran. Le protocole,
 * lui, vit dans l'URL (use-protocol.ts).
 */
export const useLivePrefs = create<LivePrefs>()((set) => ({
  muted: false,
  volume: DEFAULT_VOLUME,
  overlaysPinned: false,
  toggleMuted: () =>
    set((state) =>
      state.muted && state.volume === 0
        ? { muted: false, volume: DEFAULT_VOLUME }
        : { muted: !state.muted }
    ),
  setMuted: (muted) => set({ muted }),
  setVolume: (volume) => set({ volume, muted: volume === 0 }),
  toggleOverlaysPinned: () =>
    set((state) => ({ overlaysPinned: !state.overlaysPinned })),
}))
