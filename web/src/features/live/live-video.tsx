import { useRef, type ReactNode } from "react"
import { LoaderCircleIcon, PauseIcon, VideoOffIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { useLivePrefs } from "@/features/live/prefs-store"
import { useStationVideo } from "@/features/live/use-station-video"
import { videoOverlay } from "@/features/live/values"
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

/** Statut du poste sur la video : pilule blanche, texte et pastille du statut. */
export function VideoStatusBadge({ status }: { status: StationStatus }) {
  return <StatusBadge status={status} className="bg-white/90" />
}

export function LiveVideo({
  stationId,
  status,
  size,
  preview = false,
  className,
  children,
}: {
  stationId: string
  status: StationStatus
  size: keyof typeof SIZES
  /** Apercu (tuiles de la mosaique) : premiere image du flux seulement, sans son. */
  preview?: boolean
  className?: string
  /** Surimpressions (pilote, statut, telemetrie). */
  children?: ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const snapshotRef = useRef<HTMLCanvasElement>(null)
  const protocol = useLivePrefs((s) => s.protocol)
  const muted = useLivePrefs((s) => s.muted)
  const offline = status === "offline"
  const state = useStationVideo(videoRef, {
    stationId,
    protocol,
    enabled: !offline,
    snapshotRef: preview ? snapshotRef : undefined,
  })
  const sizing = SIZES[size]
  const overlay = videoOverlay(status, state)
  const OverlayIcon =
    overlay?.kind === "loading"
      ? LoaderCircleIcon
      : overlay?.kind === "paused"
        ? PauseIcon
        : VideoOffIcon

  return (
    <div
      className={cn(
        "overflow-hidden bg-sand-950 text-white",
        sizing.frame,
        className
      )}
    >
      {offline ? null : (
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
      )}

      {/* apercu : premiere image du flux, visible une fois copiee */}
      {preview && !offline ? (
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

      {children}
    </div>
  )
}
