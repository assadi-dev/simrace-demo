import { useEffect, useRef, type ReactNode } from "react"
import { LoaderCircleIcon, PauseIcon, VideoOffIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useLivePrefs } from "@/features/live/prefs-store"
import { useStationVideo } from "@/features/live/use-station-video"
import {
  liveBadgeStatus,
  videoOverlay,
  type LiveBadgeStatus,
} from "@/features/live/values"
import { VideoControls } from "@/features/live/video-controls"
import type { StationStatus } from "@/features/stations/status"
import { cn } from "@/lib/utils"

/*
 * Lecteur d'un poste (maquettes 5, 6 et 7). Les tailles suivent les maquettes : icone de 40,
 * 64 et 80 px, texte de 13, 15 et 16 px, le tout multiplie par --ui-scale. En tuile et en
 * grand, cadre 16/9 ; en plein ecran, la video remplit l'ecran sans etre deformee (bandes noires
 * si l'ecran n'est pas en 16/9). Pas de pastille de protocole ni de latence : valeurs non mesurees.
 */
const SIZES = {
  tile: {
    frame: "relative aspect-video rounded-md",
    placeholder: "gap-2 text-caption text-white/70",
    icon: "size-10",
  },
  focus: {
    frame: "relative aspect-video rounded-md",
    placeholder: "gap-2.5 text-nav font-normal text-white/70",
    icon: "size-16",
  },
  fullscreen: {
    frame: "absolute inset-0",
    placeholder:
      "gap-3 text-[calc(16px*var(--ui-scale))] leading-6 text-white/50",
    icon: "size-20",
  },
} as const

/** Pastille sombre posee sur la video (fond encre 70 %). */
export function OverlayChip({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sand-950/70 whitespace-nowrap text-white",
        className
      )}
    >
      {children}
    </span>
  )
}

/*
 * Pastilles des vues Live (design.md 1.5 : jamais la couleur seule). Formes : rond plein
 * (en course), carre (pause), losange (pret : flux sans telemetrie), anneau (hors ligne).
 */
const LIVE_BADGE = {
  racing: {
    label: "En course",
    variant: "success",
    dot: "rounded-full bg-success",
  },
  paused: {
    label: "En pause",
    variant: "warning",
    dot: "rounded-[2px] bg-warning",
  },
  ready: {
    label: "Prêt",
    variant: "info",
    dot: "size-1.75 rotate-45 rounded-[1px] bg-info",
  },
  offline: {
    label: "Hors ligne",
    variant: "danger",
    dot: "rounded-full border-2 border-danger",
  },
} as const

/** Statut du poste sur la video (telemetrie + flux) : pilule blanche, libelle et pastille. */
export function LiveStatusBadge({
  status,
  className,
}: {
  status: LiveBadgeStatus
  className?: string
}) {
  const badge = LIVE_BADGE[status]
  return (
    <Badge variant={badge.variant} className={cn("bg-white/90", className)}>
      <span aria-hidden="true" className={cn("size-2 shrink-0", badge.dot)} />
      {badge.label}
    </Badge>
  )
}

export function LiveVideo({
  stationId,
  status,
  size,
  preview = false,
  controls = false,
  className,
  children,
}: {
  stationId: string
  status: StationStatus
  size: keyof typeof SIZES
  /** Apercu (tuiles de la mosaique) : premiere image du flux seulement, sans son. */
  preview?: boolean
  /** Commandes facon YouTube (lecture, son, Direct, plein ecran), en fondu au survol. */
  controls?: boolean
  className?: string
  /**
   * Surimpressions (pilote, statut, telemetrie). Fonction : recoit le statut a afficher, qui
   * combine la telemetrie et l'etat du flux.
   */
  children?: ReactNode | ((video: { badge: LiveBadgeStatus }) => ReactNode)
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const snapshotRef = useRef<HTMLCanvasElement>(null)
  const protocol = useLivePrefs((s) => s.protocol)
  const muted = useLivePrefs((s) => s.muted)
  const volume = useLivePrefs((s) => s.volume)
  // la video ne depend pas de la telemetrie : un poste "hors ligne" peut diffuser quand meme
  const state = useStationVideo(videoRef, {
    stationId,
    protocol,
    snapshotRef: preview ? snapshotRef : undefined,
  })
  const sizing = SIZES[size]
  const overlay = videoOverlay(status, state)

  // le volume n'est pas un attribut HTML : il se regle sur l'element
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume
  }, [volume])
  const OverlayIcon =
    overlay?.kind === "loading"
      ? LoaderCircleIcon
      : overlay?.kind === "paused"
        ? PauseIcon
        : VideoOffIcon

  return (
    <div
      className={cn(
        "group/player overflow-hidden bg-sand-950 text-white",
        sizing.frame,
        className
      )}
    >
      <video
        ref={videoRef}
        muted={preview || muted}
        autoPlay
        playsInline
        aria-label={`Vidéo du poste ${stationId}`}
        className={cn(
          "absolute inset-0 size-full",
          size === "fullscreen" ? "object-contain" : "object-cover"
        )}
      />

      {/* apercu : premiere image du flux, visible une fois copiee */}
      {preview ? (
        <canvas
          ref={snapshotRef}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-full object-cover",
            state.kind !== "snapshot" && "invisible"
          )}
        />
      ) : null}

      {overlay ? (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center text-center",
            // chargement et flux absent : fond plein, rien de l'image en dessous
            overlay.kind === "paused" ? "bg-sand-950/55" : "bg-sand-950",
            sizing.placeholder
          )}
        >
          <OverlayIcon
            aria-hidden="true"
            strokeWidth={1.5}
            className={cn(
              sizing.icon,
              overlay.kind === "loading" && "motion-safe:animate-spin"
            )}
          />
          <span>{overlay.text}</span>
        </div>
      ) : null}

      {typeof children === "function"
        ? children({ badge: liveBadgeStatus(status, state) })
        : children}

      {controls ? (
        <VideoControls
          videoRef={videoRef}
          stationId={stationId}
          playing={state.kind === "playing"}
        />
      ) : null}
    </div>
  )
}
