import { useEffect, useState, type ReactNode, type RefObject } from "react"
import { Link } from "@tanstack/react-router"
import {
  MaximizeIcon,
  PauseIcon,
  PlayIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLivePrefs } from "@/features/live/prefs-store"
import {
  canFullscreenPage,
  enterVideoFullscreen,
  requestPageFullscreen,
} from "@/lib/fullscreen"
import { cn } from "@/lib/utils"

/** Pilule sombre des commandes (comme celles de YouTube), posee sur la video. */
const pill =
  "inline-flex h-10 items-center rounded-full bg-sand-950/70 text-white"
/** Bouton rond d'une commande, icone seule (le libelle passe par l'info-bulle). */
export const iconButton = cn(
  pill,
  "w-10 justify-center outline-none hover:bg-sand-950/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
)

/** Info-bulle d'une commande, au-dessus du bouton (survol et focus clavier). */
export function ControlTooltip({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Lecture ou pause de la balise <video>, suivie par ses evenements. */
export function usePaused(videoRef: RefObject<HTMLVideoElement | null>) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const update = () => setPaused(video.paused)
    video.addEventListener("play", update)
    video.addEventListener("pause", update)
    return () => {
      video.removeEventListener("play", update)
      video.removeEventListener("pause", update)
    }
  }, [videoRef])
  return paused
}

/** Bouton lecture / pause, avec son info-bulle. `paused` vient de `usePaused`. */
export function PlayButton({
  videoRef,
  paused,
  playing,
  className,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  paused: boolean
  /** Le flux est lu : sans flux, le bouton est desactive. */
  playing: boolean
  className?: string
}) {
  const label = paused ? "Lire" : "Pause"
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }
  return (
    <ControlTooltip label={label}>
      <button
        type="button"
        onClick={togglePlay}
        disabled={!playing}
        aria-label={label}
        className={cn(iconButton, className)}
      >
        {paused ? (
          <PlayIcon aria-hidden="true" className="size-5 fill-current" />
        ) : (
          <PauseIcon aria-hidden="true" className="size-5 fill-current" />
        )}
      </button>
    </ControlTooltip>
  )
}

/** Son : bouton couper / activer, et curseur de volume deplie au survol ou au focus (YouTube). */
export function VolumeControl({
  playing,
  className,
}: {
  /** Le flux est lu : sans flux, le son est desactive. */
  playing: boolean
  className?: string
}) {
  const muted = useLivePrefs((s) => s.muted)
  const volume = useLivePrefs((s) => s.volume)
  const toggleMuted = useLivePrefs((s) => s.toggleMuted)
  const setVolume = useLivePrefs((s) => s.setVolume)
  const shownVolume = muted ? 0 : volume
  const VolumeIcon =
    shownVolume === 0
      ? VolumeXIcon
      : shownVolume < 0.5
        ? Volume1Icon
        : Volume2Icon
  const label = muted ? "Activer le son" : "Couper le son"

  return (
    <div className={cn(pill, "group/volume gap-1 pr-1", className)}>
      <ControlTooltip label={label}>
        <button
          type="button"
          onClick={toggleMuted}
          disabled={!playing}
          aria-label={label}
          className="inline-flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <VolumeIcon aria-hidden="true" className="size-5" />
        </button>
      </ControlTooltip>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={shownVolume}
        disabled={!playing}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Volume"
        className="w-0 cursor-pointer accent-white opacity-0 transition-[width,opacity] duration-200 group-focus-within/volume:mr-2 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:mr-2 group-hover/volume:w-20 group-hover/volume:opacity-100"
      />
    </div>
  )
}

/**
 * Commandes du lecteur de la vue en grand, inspirees de YouTube : lecture et pause, son avec
 * curseur de volume (deplie au survol), pastille "Direct" (pas de duree : flux en direct), plein
 * ecran a droite, chacune avec son info-bulle. Elles apparaissent en fondu quand la souris entre sur la video (`group/player`
 * du cadre), et restent visibles en pause, au clavier et sur un ecran tactile.
 */
export function VideoControls({
  videoRef,
  stationId,
  playing,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  stationId: string
  /** Le flux est lu : sans flux, lecture et son sont desactives. */
  playing: boolean
}) {
  const paused = usePaused(videoRef)

  return (
    <TooltipProvider>
      <div
        data-slot="video-controls"
        data-paused={paused || undefined}
        className={cn(
          "absolute inset-x-4 bottom-4 flex items-center justify-between gap-2",
          "opacity-0 transition-opacity duration-200 group-hover/player:opacity-100",
          "focus-within:opacity-100 data-paused:opacity-100 pointer-coarse:opacity-100"
        )}
      >
        <div className="flex items-center gap-2">
          <PlayButton videoRef={videoRef} paused={paused} playing={playing} />
          <VolumeControl playing={playing} />

          <span className={cn(pill, "gap-2 px-3.5 text-label font-semibold")}>
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                playing && !paused ? "bg-danger" : "bg-white/50"
              )}
            />
            Direct
          </span>
        </div>

        <ControlTooltip label="Plein écran">
          <Link
            to="/live/$stationId/plein-ecran"
            params={{ stationId }}
            search
            aria-label="Plein écran"
            className={iconButton}
            onClick={(event) => {
              // demande faite pendant le clic : sinon le navigateur la refuse (mobile surtout)
              if (canFullscreenPage()) return requestPageFullscreen()
              // iPhone : pas de plein ecran de page, la video passe dans le lecteur d'iOS
              const video = videoRef.current
              if (video && enterVideoFullscreen(video)) event.preventDefault()
            }}
          >
            <MaximizeIcon aria-hidden="true" className="size-5" />
          </Link>
        </ControlTooltip>
      </div>
    </TooltipProvider>
  )
}
