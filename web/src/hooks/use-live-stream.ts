import { useEffect } from "react"

import { samplesEventSchema } from "@/contracts/telemetry"
import { API_URL } from "@/lib/api"
import { useLiveStore } from "@/stores/live-store"

/**
 * Ouvre l'unique EventSource de l'application (GET /stream) et alimente le store.
 * A monter une seule fois, dans la route racine.
 */
export function useLiveStream() {
  useEffect(() => {
    const { setConnection, pushSamples, countInvalidEvent } =
      useLiveStore.getState()

    setConnection("connecting")
    const source = new EventSource(`${API_URL}/stream`)

    source.onopen = () => setConnection("connected")
    // Le navigateur se reconnecte seul tant que l'etat n'est pas CLOSED.
    source.onerror = () =>
      setConnection(
        source.readyState === EventSource.CLOSED ? "offline" : "reconnecting"
      )
    source.addEventListener("samples", (event) => {
      let payload: unknown
      try {
        payload = JSON.parse(event.data)
      } catch {
        countInvalidEvent()
        return
      }
      const parsed = samplesEventSchema.safeParse(payload)
      if (parsed.success) pushSamples(parsed.data)
      else countInvalidEvent()
    })

    return () => source.close()
  }, [])
}
