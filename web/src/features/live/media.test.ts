import { describe, expect, it } from "vitest"

import {
  hlsUrl,
  isMixedContent,
  MEDIAMTX_STREAM_NAME_PATTERN,
  mediaStreamNameSchema,
  toMediaStreamName,
  whepUrl,
} from "@/features/live/media"

/** Identifiant envoye par defaut par l'agent : le nom du PC Windows, en majuscules. */
const UPPERCASE_STATION_ID = "SIM-STATION-POSTE-1"
/** Le meme poste, tel que MediaMTX l'attend dans le chemin du flux (decision 0019). */
const EXPECTED_STREAM_NAME = "sim-station-poste-1"
const MEDIAMTX_WEBRTC_BASE = "http://10.192.2.241:8889"
const MEDIAMTX_HLS_BASE = "http://10.192.2.241:8888"
const MEDIAMTX_HTTPS_BASE = "https://video.exemple.fr"

/** Identifiants qu'aucune mise en minuscules ne rend valides : refuses, jamais devines. */
const STATION_ID_WITH_UNDERSCORE = "sim_poste_1"
const STATION_ID_WITH_ACCENT = "poste-équipe-1"
const STATION_ID_WITH_DOUBLE_DASH = "sim--1"
const STATION_ID_WITH_EDGE_DASH = "-sim-1-"
const EMPTY_STATION_ID = ""

describe("nom de flux MediaMTX d'un poste", () => {
  it("passe l'identifiant du poste en minuscules", () => {
    expect(mediaStreamNameSchema.parse(UPPERCASE_STATION_ID)).toBe(
      EXPECTED_STREAM_NAME
    )
  })

  it("retire les espaces autour avant de valider", () => {
    expect(mediaStreamNameSchema.parse(`  ${UPPERCASE_STATION_ID} `)).toBe(
      EXPECTED_STREAM_NAME
    )
  })

  it("laisse inchange un nom deja au bon format", () => {
    expect(mediaStreamNameSchema.parse(EXPECTED_STREAM_NAME)).toBe(
      EXPECTED_STREAM_NAME
    )
    expect(EXPECTED_STREAM_NAME).toMatch(MEDIAMTX_STREAM_NAME_PATTERN)
  })

  it("refuse un identifiant qui ne peut pas devenir un nom de flux", () => {
    for (const invalid of [
      STATION_ID_WITH_UNDERSCORE,
      STATION_ID_WITH_ACCENT,
      STATION_ID_WITH_DOUBLE_DASH,
      STATION_ID_WITH_EDGE_DASH,
      EMPTY_STATION_ID,
    ]) {
      expect(mediaStreamNameSchema.safeParse(invalid).success).toBe(false)
      expect(toMediaStreamName(invalid)).toBeNull()
    }
  })
})

describe("URL des apercus WebRTC et HLS", () => {
  it("ajoutent le chemin du flux, en minuscules, a l'adresse de base de chaque protocole", () => {
    const streamName = toMediaStreamName(UPPERCASE_STATION_ID)

    expect(streamName).toBe(EXPECTED_STREAM_NAME)
    expect(whepUrl(MEDIAMTX_WEBRTC_BASE, EXPECTED_STREAM_NAME)).toBe(
      `${MEDIAMTX_WEBRTC_BASE}/live/${EXPECTED_STREAM_NAME}/whep`
    )
    expect(hlsUrl(MEDIAMTX_HLS_BASE, EXPECTED_STREAM_NAME)).toBe(
      `${MEDIAMTX_HLS_BASE}/live/${EXPECTED_STREAM_NAME}/index.m3u8`
    )
    expect(whepUrl(MEDIAMTX_HTTPS_BASE, EXPECTED_STREAM_NAME)).toBe(
      `${MEDIAMTX_HTTPS_BASE}/live/${EXPECTED_STREAM_NAME}/whep`
    )
  })
})

describe("contenu mixte (decision 0020)", () => {
  it("bloque une adresse http depuis une page https", () => {
    expect(isMixedContent("https:", MEDIAMTX_WEBRTC_BASE)).toBe(true)
  })

  it("laisse passer https depuis https, et tout depuis une page http", () => {
    expect(isMixedContent("https:", MEDIAMTX_HTTPS_BASE)).toBe(false)
    expect(isMixedContent("http:", MEDIAMTX_WEBRTC_BASE)).toBe(false)
    expect(isMixedContent("http:", MEDIAMTX_HTTPS_BASE)).toBe(false)
  })
})
