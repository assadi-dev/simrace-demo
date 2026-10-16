import { parseAsStringLiteral, useQueryState } from "nuqs"

import { PROTOCOLS } from "@/features/live/media"

/**
 * Protocole video des pages Live, dans l'URL (`?protocole=hls`) : il suit la mosaique, la vue en
 * grand et le plein ecran (liens avec `search`), survit au rechargement et se partage. WebRTC par
 * defaut, absent de l'URL (nuqs retire la valeur par defaut). Une valeur inconnue revient a WebRTC.
 */
export const protocolParser =
  parseAsStringLiteral(PROTOCOLS).withDefault("webrtc")

export function useProtocol() {
  return useQueryState("protocole", protocolParser)
}
