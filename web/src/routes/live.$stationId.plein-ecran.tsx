import { useEffect } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { MinimizeIcon, Volume2Icon, VolumeXIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { LiveVideo } from "@/features/live/live-video"
import { useLivePrefs } from "@/features/live/prefs-store"
import { StationThumb } from "@/features/live/station-thumb"
import { useLiveFeed } from "@/features/live/use-live-feed"
import { liveStats, roundedSpeed } from "@/features/live/values"
import { stationStatus } from "@/features/stations/status"
import { liveValues } from "@/features/stations/summary"
import { NOT_AVAILABLE } from "@/lib/format"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/live/$stationId/plein-ecran")({
  component: LiveFullscreenPage,
})

/** Surface sombre posee sur la video (encre 70 %, contour blanc 12 %). */
const glass = "border border-white/12 bg-sand-950/70"

/**
 * Plein ecran d'un poste (maquette 7, reference 1600 x 900). Couche fixe au-dessus de l'appli
 * et plein ecran du navigateur quand il l'accorde. Echap revient a la vue en grand.
 */
function LiveFullscreenPage() {
  const { stationId } = Route.useParams()
  const navigate = useNavigate()
  const feed = useLiveFeed()
  const muted = useLivePrefs((s) => s.muted)
  const toggleMuted = useLivePrefs((s) => s.toggleMuted)

  useEffect(() => {
    const exit = () =>
      void navigate({ to: "/live/$stationId", params: { stationId } })
    // le clic qui a ouvert la page autorise le plein ecran ; sinon la couche fixe suffit
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
    // en plein ecran, Echap est pris par le navigateur : on suit sa sortie
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) exit()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") exit()
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [navigate, stationId])

  // quitter la page (Quitter, retour arriere) quitte aussi le plein ecran
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen()
    },
    []
  )

  const entry = feed.find((e) => e.station.station_id === stationId)
  const status = entry
    ? stationStatus(entry.station.online, entry.live)
    : "offline"
  const sample = entry?.live?.latest
  const session = entry?.live?.session ?? entry?.station.session
  const values = liveValues(status, sample)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Plein écran ${stationId}`}
      className="fixed inset-0 z-50 overflow-hidden bg-sand-950 text-white"
    >
      <LiveVideo
        key={stationId}
        stationId={stationId}
        status={status}
        size="fullscreen"
      >
        {(video) => (
          <>
            {/* Haut : identite et sortie */}
            <div className="absolute inset-x-6 top-6 flex items-start justify-between gap-4">
              <div
                className={cn(
                  "flex min-w-0 flex-col gap-0.5 rounded-xl px-4.5 py-3",
                  glass
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="truncate text-brand">
                    {session?.driver ?? NOT_AVAILABLE} · {stationId}
                  </span>
                  <StatusBadge status={status} className="bg-white/90" />
                </div>
                <span className="truncate text-caption text-white/70">
                  {session
                    ? [
                        session.track,
                        session.car,
                        entry?.station.machine ?? NOT_AVAILABLE,
                      ].join(" · ")
                    : "Poste inconnu"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-3 py-1.5 text-badge whitespace-nowrap text-white/70",
                    glass
                  )}
                >
                  {video.label}
                </span>
                <button
                  type="button"
                  onClick={toggleMuted}
                  aria-label={muted ? "Activer le son" : "Couper le son"}
                  aria-pressed={!muted}
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-full outline-none hover:bg-sand-950/90 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    glass
                  )}
                >
                  {muted ? (
                    <VolumeXIcon aria-hidden="true" className="size-4.5" />
                  ) : (
                    <Volume2Icon aria-hidden="true" className="size-4.5" />
                  )}
                </button>
                <Link
                  to="/live/$stationId"
                  params={{ stationId }}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4.5 text-nav font-semibold whitespace-nowrap text-foreground outline-none hover:bg-white/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <MinimizeIcon aria-hidden="true" className="size-4.5" />
                  Quitter (Échap)
                </Link>
              </div>
            </div>

            {/* Droite : changer de poste (208 px) */}
            <nav
              aria-label="Postes"
              className={cn(
                "absolute top-30 right-6 flex max-h-[calc(100%-120px-24px)] w-52 flex-col gap-2 overflow-y-auto rounded-xl p-2.5",
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

            {/* Bas : bandeau telemetrie, jusqu'a 256 px du bord droit (colonne des postes) */}
            <div className="absolute right-64 bottom-6 left-6 flex flex-col gap-3.5 rounded-2xl border border-white/12 bg-sand-950/80 px-5.5 py-4.5">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-display">
                    {roundedSpeed(status, sample)}
                  </span>
                  <span className="text-[15px] leading-5 text-white/70">
                    km/h
                  </span>
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
                      className={cn(
                        "text-brand",
                        stat.muted && "text-white/70"
                      )}
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
          </>
        )}
      </LiveVideo>
    </div>
  )
}
