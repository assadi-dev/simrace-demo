import { describe, expect, it } from "vitest"

import { parseConfig } from "./config"

describe("parseConfig", () => {
  it("prend les valeurs par defaut quand rien n'est defini (1 poste max, pas de video)", () => {
    expect(parseConfig({})).toEqual({
      apiUrl: "http://localhost:8000",
      maxStations: 1,
      media: { webrtc: null, hls: null },
    })
  })

  it("traite une valeur vide comme absente", () => {
    expect(
      parseConfig({
        VITE_API_URL: "",
        VITE_MAX_STATIONS: "",
        VITE_MEDIA_HOST: "",
      })
    ).toEqual({
      apiUrl: "http://localhost:8000",
      maxStations: 1,
      media: { webrtc: null, hls: null },
    })
  })

  it("lit l'URL du serveur, le nombre de postes max et l'hote MediaMTX (texte du .env)", () => {
    expect(
      parseConfig({
        VITE_API_URL: "http://10.192.2.241:8000/",
        VITE_MAX_STATIONS: "4",
        VITE_MEDIA_HOST: "10.192.2.241",
      })
    ).toEqual({
      apiUrl: "http://10.192.2.241:8000",
      maxStations: 4,
      media: {
        webrtc: "http://10.192.2.241:8889",
        hls: "http://10.192.2.241:8888",
      },
    })
  })

  it("refuse un nombre de postes invalide plutot que de l'afficher", () => {
    expect(() => parseConfig({ VITE_MAX_STATIONS: "quatre" })).toThrow()
    expect(() => parseConfig({ VITE_MAX_STATIONS: "0" })).toThrow()
    expect(() => parseConfig({ VITE_MAX_STATIONS: "2.5" })).toThrow()
  })

  it("refuse une URL de serveur invalide", () => {
    expect(() => parseConfig({ VITE_API_URL: "10.192.2.241:8000" })).toThrow()
  })

  it("prend les URL completes de MediaMTX avant l'hote (proxy https, decision 0020)", () => {
    expect(
      parseConfig({
        VITE_MEDIA_HOST: "10.192.2.241",
        VITE_MEDIA_WEBRTC_URL: "https://video.exemple.fr/",
      }).media
    ).toEqual({
      webrtc: "https://video.exemple.fr",
      hls: "http://10.192.2.241:8888",
    })
  })

  it("accepte une URL WebRTC seule, sans hote ni HLS", () => {
    expect(
      parseConfig({ VITE_MEDIA_WEBRTC_URL: "https://video.exemple.fr" }).media
    ).toEqual({ webrtc: "https://video.exemple.fr", hls: null })
  })

  it("refuse une URL MediaMTX invalide", () => {
    expect(() =>
      parseConfig({ VITE_MEDIA_WEBRTC_URL: "video.exemple.fr" })
    ).toThrow()
    expect(() => parseConfig({ VITE_MEDIA_HLS_URL: "pas une url" })).toThrow()
  })

  it("refuse un hote MediaMTX avec schema ou port", () => {
    expect(() =>
      parseConfig({ VITE_MEDIA_HOST: "http://10.192.2.241" })
    ).toThrow()
    expect(() =>
      parseConfig({ VITE_MEDIA_HOST: "10.192.2.241:8889" })
    ).toThrow()
  })
})
