import { useEffect, useState } from "react"

const ACTIVITY_EVENTS = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
] as const

/**
 * Vrai apres `delayMs` sans activite (souris, toucher, clavier, molette), faux des la suivante.
 * Sert a masquer les surimpressions du plein ecran, comme un lecteur video.
 */
export function useIdle(delayMs: number) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), delayMs)
    }
    const wake = () => {
      setIdle(false)
      arm()
    }
    arm()
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, wake)
    return () => {
      clearTimeout(timer)
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, wake)
    }
  }, [delayMs])
  return idle
}
