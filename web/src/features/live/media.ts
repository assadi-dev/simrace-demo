/*
 * Adresses des flux video MediaMTX (decision 0019) : un flux par poste sur `live/<station-id>`,
 * lu en WebRTC (WHEP, port 8889, faible latence) ou en HLS (port 8888, repli).
 */

export const PROTOCOLS = ["webrtc", "hls"] as const
export type Protocol = (typeof PROTOCOLS)[number]

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  webrtc: "WebRTC",
  hls: "HLS",
}

const WEBRTC_PORT = 8889
const HLS_PORT = 8888

const streamPath = (stationId: string) =>
  `live/${encodeURIComponent(stationId)}`

/** Point d'entree WHEP : POST de l'offre SDP, reponse 201 avec la reponse SDP. */
export const whepUrl = (host: string, stationId: string) =>
  `http://${host}:${WEBRTC_PORT}/${streamPath(stationId)}/whep`

/** Liste de lecture HLS. */
export const hlsUrl = (host: string, stationId: string) =>
  `http://${host}:${HLS_PORT}/${streamPath(stationId)}/index.m3u8`
