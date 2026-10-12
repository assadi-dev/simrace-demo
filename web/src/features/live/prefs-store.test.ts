import { beforeEach, describe, expect, it } from "vitest"

import { DEFAULT_VOLUME, useLivePrefs } from "@/features/live/prefs-store"

const INITIAL_PREFS = useLivePrefs.getState()
const LOWERED_VOLUME = 0.1

describe("reglages de lecture de la page Live", () => {
  beforeEach(() => useLivePrefs.setState(INITIAL_PREFS, true))

  it("demarre avec le son actif a 30 %", () => {
    const { muted, volume } = useLivePrefs.getState()
    expect(DEFAULT_VOLUME).toBe(0.3)
    expect(muted).toBe(false)
    expect(volume).toBe(DEFAULT_VOLUME)
  })

  it("coupe le son quand le curseur descend a zero, le reactive au-dessus", () => {
    useLivePrefs.getState().setVolume(0)
    expect(useLivePrefs.getState().muted).toBe(true)

    useLivePrefs.getState().setVolume(LOWERED_VOLUME)
    expect(useLivePrefs.getState()).toMatchObject({
      muted: false,
      volume: LOWERED_VOLUME,
    })
  })

  it("reprend 30 % quand on reactive le son apres l'avoir baisse a zero", () => {
    useLivePrefs.getState().setVolume(0)
    useLivePrefs.getState().toggleMuted()
    expect(useLivePrefs.getState()).toMatchObject({
      muted: false,
      volume: DEFAULT_VOLUME,
    })
  })

  it("garde le volume choisi quand on coupe puis reactive le son", () => {
    useLivePrefs.getState().setVolume(LOWERED_VOLUME)
    useLivePrefs.getState().toggleMuted()
    useLivePrefs.getState().toggleMuted()
    expect(useLivePrefs.getState()).toMatchObject({
      muted: false,
      volume: LOWERED_VOLUME,
    })
  })
})
