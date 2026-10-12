import { useRef, type ReactNode } from "react"
import { PauseIcon, VideoIcon, VideoOffIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { PROTOCOL_LABEL } from "@/features/live/media"
import { MOCK_POSTERS } from "@/features/live/mock"
import { useLivePrefs } from "@/features/live/prefs-store"
import {
  useStationVideo,
  type VideoState,
} from "@/features/live/use-station-video"
import { videoLabel } from "@/features/live/values"
import type { StationStatus } from "@/features/stations/status"
import { cn } from "@/lib/utils"

/*
 * Lecteur d'un poste (maquettes 5, 6 et 7). Les tailles suivent les maquettes : icone de 40,
 * 64 et 80 px, texte de 13, 15 et 16 px. En tuile et en grand, cadre 16/9 ; en plein ecran,
 * la video remplit l'ecran sans etre deformee (bandes noires si l'ecran n'est pas en 16/9).
 */
const SIZES = {
  tile: {
    frame: "relative aspect-video rounded-md",
    placeholder: "gap-2 text-caption text-white/70",
    icon: "size-10",
  },
  focus: {
    frame: "relative aspect-video rounded-md",
    placeholder: "gap-2.5 text-[15px] leading-5 text-white/70",
    icon: "size-16",
  },
  fullscreen: {
    frame: "absolute inset-0",
    placeholder: "gap-3 text-base leading-6 text-white/50",
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
  className,
  children,
}: {
  stationId: string
  status: StationStatus
  size: keyof typeof SIZES
  className?: string
  /** Surimpressions, avec l'etat de la lecture et le libelle de la pastille du protocole. */
  children?: (video: { state: VideoState; label: string }) => ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const protocol = useLivePrefs((s) => s.protocol)
  const muted = useLivePrefs((s) => s.muted)
  const offline = status === "offline"
  const state = useStationVideo(videoRef, {
    stationId,
    protocol,
    enabled: !offline,
  })
  const poster = MOCK_POSTERS[stationId]
  const sizing = SIZES[size]
  const protocolLabel = PROTOCOL_LABEL[protocol]

  const placeholder = offline
    ? { icon: VideoOffIcon, text: "Flux indisponible : poste hors ligne" }
    : status === "paused"
      ? { icon: PauseIcon, text: "Session en pause, image figée" }
      : !poster && state.kind !== "playing"
        ? {
            icon: VideoIcon,
            text: `Flux vidéo ${protocolLabel} du poste ${stationId}`,
          }
        : null

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
          poster={poster}
          muted={muted}
          autoPlay
          playsInline
          aria-label={`Vidéo du poste ${stationId}`}
          className={cn(
            "absolute inset-0 size-full",
            size === "fullscreen" ? "object-contain" : "object-cover"
          )}
        />
      )}

      {placeholder ? (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center",
            status === "paused" && "bg-sand-950/55",
            sizing.placeholder
          )}
        >
          <placeholder.icon
            aria-hidden="true"
            strokeWidth={1.5}
            className={sizing.icon}
          />
          <span>{placeholder.text}</span>
        </div>
      ) : null}

      {children?.({ state, label: videoLabel(protocolLabel, state) })}
    </div>
  )
}
