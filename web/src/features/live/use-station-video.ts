import { useEffect, useState, type RefObject } from "react"

import {
  hlsUrl,
  isMixedContent,
  PROTOCOL_LABEL,
  toMediaStreamName,
  whepUrl,
  type Protocol,
} from "@/features/live/media"
import { useLivePrefs } from "@/features/live/prefs-store"
import { config } from "@/lib/config"

/*
 * Lecture du flux video d'un poste (decision 0019). WebRTC : client WHEP ecrit a la main, comme
 * tools/video-viewer.html. HLS : lecture native du navigateur (Safari, Chrome recent), sans
 * bibliotheque.
 *
 * Mode apercu (tuiles de la mosaique) : video seule, sans piste audio. La premiere image decodee
 * est copiee dans un <canvas>, puis la connexion est fermee : une tuile ne consomme du reseau que
 * le temps d'une image (environ une seconde avec un GOP de 1 s, decision 0019).
 */

export type VideoState =
  /** Aucune adresse MediaMTX configuree (VITE_MEDIA_HOST ou VITE_MEDIA_*_URL) : aucune video. */
  | { kind: "unconfigured" }
  | { kind: "connecting" }
  | { kind: "playing" }
  /** Apercu : premiere image copiee a `at` (horloge du navigateur), flux ferme. */
  | { kind: "snapshot"; at: number }
  | { kind: "error"; reason: string }

/** Nouvel essai apres un echec : OBS peut demarrer apres l'ouverture de la page. */
const RETRY_MS = 5000
/** ICE se retablit souvent seul : on n'abandonne que si la coupure dure. */
const DISCONNECT_GRACE_MS = 4000
/** Offre envoyee sans attendre plus longtemps les candidats ICE (reseau local). */
const ICE_GATHERING_MS = 2000

type Report = (state: VideoState) => void

function iceGathered(peer: RTCPeerConnection) {
  return new Promise<void>((resolve) => {
    if (peer.iceGatheringState === "complete") return resolve()
    const timeout = setTimeout(resolve, ICE_GATHERING_MS)
    peer.addEventListener("icegatheringstatechange", () => {
      if (peer.iceGatheringState === "complete") {
        clearTimeout(timeout)
        resolve()
      }
    })
  })
}

/**
 * Lance la lecture. Si le navigateur refuse le son sans geste de l'utilisateur (politique
 * d'autolecture : URL ouverte directement, page rechargee), coupe le son et relance : la video
 * demarre quand meme, et le reglage passe a "son coupe" pour que les commandes le montrent.
 */
function startPlayback(video: HTMLVideoElement) {
  video.play().catch((error: unknown) => {
    const blocked =
      error instanceof DOMException && error.name === "NotAllowedError"
    if (!blocked || video.muted) return
    video.muted = true
    useLivePrefs.getState().setMuted(true)
    void video.play().catch(() => {})
  })
}

/** Copie l'image affichee par `video` dans `canvas`, a sa taille d'origine. */
function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext("2d")?.drawImage(video, 0, 0)
}

function explainStatus(status: number) {
  if (status === 404) return "aucun flux publié"
  if (status === 401 || status === 403) return "lecture refusée"
  return `réponse ${status}`
}

/**
 * Lit un flux WHEP dans `video`, reessaie apres un echec. Avec `snapshot`, s'arrete apres la
 * premiere image, copiee dans ce canvas. Renvoie la fonction d'arret.
 */
function playWhep(
  video: HTMLVideoElement,
  url: string,
  report: Report,
  snapshot: HTMLCanvasElement | null
) {
  let stopped = false
  let frameRequest: number | undefined
  let peer: RTCPeerConnection | null = null
  let session: string | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let graceTimer: ReturnType<typeof setTimeout> | undefined

  const closePeer = () => {
    clearTimeout(graceTimer)
    if (frameRequest !== undefined) video.cancelVideoFrameCallback(frameRequest)
    frameRequest = undefined
    peer?.close()
    peer = null
    // libere la session cote MediaMTX ; une erreur ici ne change rien pour l'utilisateur
    if (session) void fetch(session, { method: "DELETE" }).catch(() => {})
    session = null
    video.srcObject = null
  }

  const fail = (reason: string) => {
    if (stopped) return
    closePeer()
    report({ kind: "error", reason })
    // nouvel essai sans repasser par "connexion" : la carte garde l'etat d'erreur
    retryTimer = setTimeout(() => void start(), RETRY_MS)
  }

  async function start() {
    const current = new RTCPeerConnection()
    peer = current
    current.addTransceiver("video", { direction: "recvonly" })
    // apercu : pas de piste audio demandee, ni son ni bande passante audio
    if (!snapshot) current.addTransceiver("audio", { direction: "recvonly" })

    current.ontrack = (event) => {
      if (peer !== current) return
      const stream = event.streams[0] ?? new MediaStream([event.track])
      if (video.srcObject !== stream) video.srcObject = stream
      startPlayback(video)
      if (snapshot && event.track.kind === "video") {
        frameRequest = video.requestVideoFrameCallback(() => {
          frameRequest = undefined
          captureFrame(video, snapshot)
          report({ kind: "snapshot", at: Date.now() })
          stop()
        })
      }
    }
    current.onconnectionstatechange = () => {
      if (peer !== current) return
      clearTimeout(graceTimer)
      const state = current.connectionState
      // en apercu, "connexion" jusqu'a la premiere image
      if (state === "connected" && !snapshot) report({ kind: "playing" })
      else if (state === "failed") fail("connexion perdue")
      else if (state === "disconnected") {
        graceTimer = setTimeout(() => fail("signal perdu"), DISCONNECT_GRACE_MS)
      }
    }

    try {
      await current.setLocalDescription(await current.createOffer())
      await iceGathered(current)
      if (peer !== current) return
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: current.localDescription?.sdp,
      })
      if (peer !== current) return
      if (response.status !== 201) return fail(explainStatus(response.status))
      const location = response.headers.get("Location")
      session = location ? new URL(location, url).toString() : null
      await current.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      })
    } catch {
      if (peer === current) fail("MediaMTX injoignable")
    }
  }

  function stop() {
    stopped = true
    clearTimeout(retryTimer)
    closePeer()
  }

  void start()
  return stop
}

/**
 * Lit une liste HLS nativement. Avec `snapshot`, s'arrete apres la premiere image, copiee dans
 * ce canvas. Renvoie la fonction d'arret.
 */
function playHls(
  video: HTMLVideoElement,
  url: string,
  report: Report,
  snapshot: HTMLCanvasElement | null
) {
  let frameRequest: number | undefined
  const onPlaying = () => {
    if (!snapshot) report({ kind: "playing" })
  }
  const onError = () => report({ kind: "error", reason: "flux indisponible" })
  const stop = () => {
    if (frameRequest !== undefined) video.cancelVideoFrameCallback(frameRequest)
    frameRequest = undefined
    video.removeEventListener("playing", onPlaying)
    video.removeEventListener("error", onError)
    video.removeAttribute("src")
    video.load()
  }
  video.addEventListener("playing", onPlaying)
  video.addEventListener("error", onError)
  video.src = url
  startPlayback(video)
  if (snapshot) {
    frameRequest = video.requestVideoFrameCallback(() => {
      frameRequest = undefined
      // l'image d'un autre domaine s'affiche dans le canvas ; elle ne peut pas en etre relue
      captureFrame(video, snapshot)
      report({ kind: "snapshot", at: Date.now() })
      stop()
    })
  }
  return stop
}

let hlsSupport: boolean | undefined
const canPlayHls = () =>
  (hlsSupport ??=
    document
      .createElement("video")
      .canPlayType("application/vnd.apple.mpegurl") !== "")

/**
 * Branche le flux du poste sur `videoRef`, que sa telemetrie soit arrivee ou non : OBS peut
 * diffuser avant que l'agent n'envoie son premier lot (ou apres qu'il s'est arrete).
 * Changer de poste ou de protocole ferme le flux precedent. Avec `snapshotRef`, mode apercu :
 * la premiere image est copiee dans ce canvas et le flux est ferme. L'URL du flux utilise le nom
 * MediaMTX du poste (identifiant en minuscules, media.ts), jamais l'identifiant brut.
 */
export function useStationVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  {
    stationId,
    protocol,
    snapshotRef,
  }: {
    stationId: string
    protocol: Protocol
    snapshotRef?: RefObject<HTMLCanvasElement | null>
  }
): VideoState {
  const configured = config.media.webrtc !== null || config.media.hls !== null
  const base = config.media[protocol]
  const streamName = toMediaStreamName(stationId)
  const url =
    base && streamName
      ? protocol === "webrtc"
        ? whepUrl(base, streamName)
        : hlsUrl(base, streamName)
      : null
  const mixedContent = url !== null && isMixedContent(location.protocol, url)
  const unsupported = protocol === "hls" && base !== null && !canPlayHls()
  const key =
    url && !mixedContent && !unsupported
      ? `${snapshotRef ? "apercu" : "direct"}:${url}`
      : null
  const [result, setResult] = useState<{
    key: string
    state: VideoState
  } | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!key || !url || !video) return
    const snapshot = snapshotRef?.current ?? null
    const report: Report = (state) => setResult({ key, state })
    return protocol === "webrtc"
      ? playWhep(video, url, report, snapshot)
      : playHls(video, url, report, snapshot)
  }, [key, url, protocol, videoRef, snapshotRef])

  if (!configured) return { kind: "unconfigured" }
  if (!base)
    return { kind: "error", reason: `${PROTOCOL_LABEL[protocol]} non configuré` }
  if (!streamName)
    return {
      kind: "error",
      reason: "identifiant de poste invalide pour la vidéo",
    }
  if (mixedContent)
    return { kind: "error", reason: "adresse http bloquée par la page https" }
  if (unsupported)
    return { kind: "error", reason: "HLS non lu par ce navigateur" }
  return result?.key === key ? result.state : { kind: "connecting" }
}
