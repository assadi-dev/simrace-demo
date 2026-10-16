import { z } from "zod"

/*
 * Adresses des flux video MediaMTX (decision 0019) : un flux par poste sur `live/<nom>`,
 * lu en WebRTC (WHEP, port 8889, faible latence) ou en HLS (port 8888, repli). L'adresse de
 * base de chaque protocole vient de la configuration (decision 0020).
 */

export const PROTOCOLS = ["webrtc", "hls"] as const
export type Protocol = (typeof PROTOCOLS)[number]

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  webrtc: "WebRTC",
  hls: "HLS",
}

/**
 * Nom d'un flux MediaMTX (decision 0019) : minuscules, chiffres, tirets simples entre les
 * mots (`sim-station-poste-1`). Ni tiret au debut ou a la fin, ni double tiret.
 */
export const MEDIAMTX_STREAM_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Identifiant de poste -> nom de flux MediaMTX. Par defaut, l'agent envoie le nom du PC
 * (`SIM-STATION-POSTE-1` sous Windows) et le serveur le garde tel quel ; le chemin du flux,
 * lui, est en minuscules : le schema retire les espaces autour, passe en minuscules, puis
 * verifie le format. Un identifiant qui ne peut pas devenir un nom de flux (`sim_1`) est
 * refuse plutot que transforme au hasard.
 */
export const mediaStreamNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    MEDIAMTX_STREAM_NAME_PATTERN,
    "minuscules, chiffres et tirets simples seulement (decision 0019)"
  )

/** Nom de flux du poste, ou null si son identifiant ne peut pas en devenir un. */
export function toMediaStreamName(stationId: string): string | null {
  const result = mediaStreamNameSchema.safeParse(stationId)
  return result.success ? result.data : null
}

/**
 * Point d'entree WHEP : POST de l'offre SDP, reponse 201 avec la reponse SDP. `base` vient de la
 * configuration (`config.media.webrtc`) : `http://<hote>:8889` ou une URL https (decision 0020).
 */
export const whepUrl = (base: string, streamName: string) =>
  `${base}/live/${streamName}/whep`

/** Liste de lecture HLS. `base` : `config.media.hls`. */
export const hlsUrl = (base: string, streamName: string) =>
  `${base}/live/${streamName}/index.m3u8`

/**
 * Une page https ne peut pas lire une adresse http (contenu mixte) : le navigateur bloque la
 * requete sans message utile. On le dit sur la carte plutot que d'essayer.
 */
export const isMixedContent = (pageProtocol: string, url: string) =>
  pageProtocol === "https:" && url.startsWith("http:")
