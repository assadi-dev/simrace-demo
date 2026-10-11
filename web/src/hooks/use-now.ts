import { useEffect, useState } from "react"

/** Heure courante, rafraichie a intervalle regulier (pour les "il y a N s"). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
