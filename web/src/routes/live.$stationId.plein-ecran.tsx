import { useEffect, useRef, useState, type RefObject } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { MinimizeIcon, PinIcon } from "lucide-react"

import { TooltipProvider } from "@/components/ui/tooltip"
import { LiveStatusBadge, LiveVideo } from "@/features/live/live-video"
import { useLivePrefs } from "@/features/live/prefs-store"
import { StationThumb } from "@/features/live/station-thumb"
import { useLiveFeed, type LiveFeedEntry } from "@/features/live/use-live-feed"
import {
  liveStats,
  roundedSpeed,
  type LiveBadgeStatus,
} from "@/features/live/values"
import {
  ControlTooltip,
  iconButton,
  PlayButton,
  usePaused,
  VolumeControl,
} from "@/features/live/video-controls"
import { gameLabel } from "@/features/stations/game"
import { stationStatus, type StationStatus } from "@/features/stations/status"
import { liveValues } from "@/features/stations/summary"
import { useIdle } from "@/hooks/use-idle"
import { NOT_AVAILABLE } from "@/lib/format"
import {
  exitPageFullscreen,
  FULLSCREEN_EVENTS,
  fullscreenElement,
  requestPageFullscreen,
} from "@/lib/fullscreen"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/live/$stationId/plein-ecran")({
  component: LiveFullscreenPage,
})

/** Surface sombre posee sur la video (encre 70 %, contour blanc 12 %). */
const glass = "border border-white/12 bg-sand-950/70"
/** Commande posee sur le bandeau du bas (deja sombre) : fond blanc 10 %. */
const barButton = "bg-white/10 hover:bg-white/20"
/** Sans activite pendant ce delai, les surimpressions se masquent (comme un lecteur video). */
const OVERLAYS_HIDE_DELAY_MS = 3000

/**
 * Plein ecran d'un poste (maquette 7, reference 1600 x 900). Couche fixe au-dessus de l'appli
 * et plein ecran du navigateur quand il l'accorde. Echap revient a la vue en grand. Les
 * surimpressions se masquent apres quelques secondes sans activite, sauf epinglees.
 */
function LiveFullscreenPage() {
  const { stationId } = Route.useParams()
  const navigate = useNavigate()
  const { feed } = useLiveFeed()
  // la video, pour les commandes du bandeau du bas (hors du lecteur)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const exit = () =>
      void navigate({
        to: "/live/$stationId",
        params: { stationId },
        search: true,
      })
    // le bouton Plein ecran le demande pendant le clic ; ici, seconde chance (lien ouvert
    // directement), souvent refusee faute de geste : la couche fixe suffit alors
    if (!fullscreenElement()) requestPageFullscreen()
    // en plein ecran, Echap est pris par le navigateur : on suit sa sortie
    const onFullscreenChange = () => {
      if (!fullscreenElement()) exit()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") exit()
    }
    for (const name of FULLSCREEN_EVENTS)
      document.addEventListener(name, onFullscreenChange)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      for (const name of FULLSCREEN_EVENTS)
        document.removeEventListener(name, onFullscreenChange)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [navigate, stationId])

  // quitter la page (Quitter, retour arriere) quitte aussi le plein ecran
  useEffect(() => () => exitPageFullscreen(), [])

  const entry = feed.find((e) => e.station.station_id === stationId)
  const status = entry
    ? stationStatus(entry.station.online, entry.live)
    : "offline"

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Plein écran ${stationId}`}
      // surimpressions masquees : le curseur aussi, comme un lecteur video
      className="fixed inset-0 z-50 overflow-hidden bg-sand-950 text-white has-data-hidden:cursor-none"
    >
      <LiveVideo
        key={stationId}
        stationId={stationId}
        status={status}
        size="fullscreen"
        videoRef={videoRef}
      >
        {({ badge, playing }) => (
          <FullscreenOverlays
            stationId={stationId}
            feed={feed}
            entry={entry}
            status={status}
            badge={badge}
            videoRef={videoRef}
            playing={playing}
          />
        )}
      </LiveVideo>
    </div>
  )
}

/**
 * Surimpressions du plein ecran : identite en haut, postes a droite, bandeau du bas sur toute la
 * largeur (lecture et son a gauche, telemetrie, epingle et sortie a droite). La colonne des
 * postes s'arrete au-dessus du bandeau. Tout se masque en fondu apres OVERLAYS_HIDE_DELAY_MS sans
 * activite, sauf epingle, video en pause ou souris posee sur une surimpression.
 */
function FullscreenOverlays({
  stationId,
  feed,
  entry,
  status,
  badge,
  videoRef,
  playing,
}: {
  stationId: string
  feed: LiveFeedEntry[]
  entry: LiveFeedEntry | undefined
  status: StationStatus
  badge: LiveBadgeStatus
  videoRef: RefObject<HTMLVideoElement | null>
  playing: boolean
}) {
  const idle = useIdle(OVERLAYS_HIDE_DELAY_MS)
  const paused = usePaused(videoRef)
  const pinned = useLivePrefs((s) => s.overlaysPinned)
  const togglePinned = useLivePrefs((s) => s.toggleOverlaysPinned)
  const [hovered, setHovered] = useState(false)
  const hidden = idle && !pinned && !paused && !hovered
  // souris posee sur une surimpression : elle reste visible
  const hoverProps = {
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
  }

  const sample = entry?.live?.latest
  const session = entry?.live?.session ?? entry?.station.session
  const values = liveValues(status, sample)

  return (
    <TooltipProvider>
      <div
        data-slot="fullscreen-overlays"
        data-hidden={hidden || undefined}
        className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3 transition-opacity duration-300 data-hidden:opacity-0 sm:gap-5 sm:p-6"
      >
        {/* Haut : identite */}
        <div
          {...hoverProps}
          className={cn(
            "pointer-events-auto flex max-w-full min-w-0 flex-col gap-0.5 self-start rounded-xl px-4.5 py-3",
            glass
          )}
        >
          <div className="flex items-center gap-3">
            <span className="truncate text-brand">
              {session?.driver ?? NOT_AVAILABLE} · {stationId}
            </span>
            <LiveStatusBadge status={badge} />
          </div>
          <span className="truncate text-caption text-white/70">
            {session
              ? [
                  session.track,
                  session.car,
                  gameLabel(session),
                  entry?.station.machine ?? NOT_AVAILABLE,
                ].join(" · ")
              : "Poste inconnu"}
          </span>
        </div>

        {/* Droite : changer de poste (208 px), jusqu'au haut du bandeau. Masquee sur un
            telephone (portrait trop etroit, paysage trop bas) : elle cacherait la video. */}
        <div className="flex min-h-0 grow justify-end">
          <nav
            {...hoverProps}
            aria-label="Postes"
            className={cn(
              "pointer-events-auto flex max-h-full w-52 flex-col gap-2 self-start overflow-y-auto rounded-xl p-2.5",
              "max-sm:hidden [@media(max-height:32rem)]:hidden",
              glass
            )}
          >
            <span className="px-1 py-0.5 text-eyebrow text-white/70">
              Postes
            </span>
            {feed.map((e) => (
              <StationThumb
                key={e.station.station_id}
                entry={e}
                selected={e.station.station_id === stationId}
                tone="dark"
              />
            ))}
          </nav>
        </div>

        {/* Bas : commandes et telemetrie, sur toute la largeur. Sur un telephone en portrait,
            les commandes seules (lecture et son a gauche, epingle et sortie a droite). */}
        <div
          {...hoverProps}
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/12 bg-sand-950/80 p-3 sm:gap-5 sm:px-5.5 sm:py-4.5"
        >
          <div className="flex shrink-0 items-center gap-2">
            <PlayButton
              videoRef={videoRef}
              paused={paused}
              playing={playing}
              className={barButton}
            />
            <VolumeControl playing={playing} className="bg-white/10" />
          </div>

          {/* telemetrie : masquee sur un telephone en portrait, la video passe d'abord */}
          <div className="flex min-w-0 grow flex-col gap-3.5 max-sm:hidden">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3 sm:gap-x-8">
              <div className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="text-metric sm:text-display">
                  {roundedSpeed(status, sample)}
                </span>
                <span className="text-nav font-normal text-white/70">km/h</span>
              </div>
              {liveStats(status, sample, { withSpeed: false }).map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col gap-0.5 whitespace-nowrap"
                >
                  <span className="text-xs font-medium text-white/70">
                    {stat.label}
                  </span>
                  <span
                    className={cn("text-brand", stat.muted && "text-white/70")}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs whitespace-nowrap text-white/70">
                Position sur le tour
              </span>
              <div className="h-2 grow overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-flame"
                  style={{ width: `${values.positionPercent}%` }}
                />
              </div>
              <span className="min-w-10 text-right text-xs font-semibold whitespace-nowrap">
                {values.position}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 max-sm:ml-auto">
            <ControlTooltip label="Épingler l'affichage">
              <button
                type="button"
                onClick={togglePinned}
                aria-label="Épingler l'affichage"
                aria-pressed={pinned}
                className={cn(
                  iconButton,
                  barButton,
                  "aria-pressed:bg-white aria-pressed:text-foreground aria-pressed:hover:bg-white/90"
                )}
              >
                <PinIcon
                  aria-hidden="true"
                  className={cn("size-5", pinned && "fill-current")}
                />
              </button>
            </ControlTooltip>
            <ControlTooltip label="Quitter le plein écran (Échap)">
              <Link
                to="/live/$stationId"
                params={{ stationId }}
                search
                aria-label="Quitter le plein écran"
                className={cn(iconButton, barButton)}
              >
                <MinimizeIcon aria-hidden="true" className="size-5" />
              </Link>
            </ControlTooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
