/*
 * Plein ecran du navigateur, avec les variantes `webkit` de Safari (iPad avant iPadOS 16.4) et de
 * Chrome sur iOS. Sur iPhone, une page ne peut pas passer en plein ecran : seule une <video> le
 * peut, dans le lecteur natif d'iOS (`webkitEnterFullscreen`).
 */

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}
type WebkitVideo = HTMLVideoElement & {
  webkitSupportsFullscreen?: boolean
  webkitEnterFullscreen?: () => void
}

/** Evenements de changement d'etat, standard et prefixe. */
export const FULLSCREEN_EVENTS = [
  "fullscreenchange",
  "webkitfullscreenchange",
] as const

const doc = () => document as WebkitDocument

/** Element en plein ecran, ou null. */
export const fullscreenElement = () =>
  document.fullscreenElement ?? doc().webkitFullscreenElement ?? null

/** Le navigateur sait mettre un element de la page en plein ecran (faux sur iPhone). */
export const canFullscreenPage = () =>
  Boolean(document.fullscreenEnabled || doc().webkitFullscreenEnabled)

/** Un refus (pas de geste de l'utilisateur, iframe) est ignore : la couche fixe reste. */
const ignoreRefusal = (result: Promise<void> | void) => {
  if (result instanceof Promise) result.catch(() => {})
}

/** Demande le plein ecran de la page. A appeler pendant un geste (clic) pour etre accorde. */
export function requestPageFullscreen() {
  const root = document.documentElement as WebkitElement
  try {
    ignoreRefusal(
      root.requestFullscreen
        ? root.requestFullscreen()
        : root.webkitRequestFullscreen?.()
    )
  } catch {
    // ancien Safari : exception synchrone au lieu d'une promesse rejetee
  }
}

export function exitPageFullscreen() {
  if (!fullscreenElement()) return
  try {
    ignoreRefusal(
      document.exitFullscreen
        ? document.exitFullscreen()
        : doc().webkitExitFullscreen?.()
    )
  } catch {
    // deja sorti
  }
}

/**
 * iPhone : ouvre la video dans le lecteur plein ecran d'iOS. Faux si le navigateur ne le
 * propose pas ou si la video n'a pas encore d'image (`webkitSupportsFullscreen`).
 */
export function enterVideoFullscreen(video: HTMLVideoElement): boolean {
  const v = video as WebkitVideo
  if (!v.webkitEnterFullscreen || !v.webkitSupportsFullscreen) return false
  try {
    v.webkitEnterFullscreen()
    return true
  } catch {
    return false
  }
}
