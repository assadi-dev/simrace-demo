import { Link } from "@tanstack/react-router"
import { VideoIcon } from "lucide-react"

import { StatusBadge, StatusDot } from "@/components/status-badge"
import { MOCK_POSTERS, type LiveFeedEntry } from "@/features/live/mock"
import { STATUS_LABEL, stationStatus } from "@/features/stations/status"
import { cn } from "@/lib/utils"

/*
 * Vignette d'un poste pour changer de lecteur : "Autres postes" de la vue en grand (clair,
 * maquette 6) et colonne "Postes" du plein ecran (sombre, maquette 7). Une vignette n'ouvre
 * aucun flux : un seul lecteur actif, l'affiche suffit.
 */
export function StationThumb({
  entry,
  selected,
  tone,
}: {
  entry: LiveFeedEntry
  selected: boolean
  tone: "light" | "dark"
}) {
  const { station, live } = entry
  const status = stationStatus(station.online, live)
  const session = live?.session ?? station.session
  const poster =
    status === "offline" ? undefined : MOCK_POSTERS[station.station_id]
  const dark = tone === "dark"

  return (
    <Link
      to={dark ? "/live/$stationId/plein-ecran" : "/live/$stationId"}
      params={{ stationId: station.station_id }}
      replace={dark}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex flex-col border text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        dark
          ? "gap-1.5 rounded-md p-1.5 text-white"
          : "gap-2 rounded-lg p-2 text-foreground",
        selected
          ? dark
            ? "border-white/40 bg-white/15"
            : "border-card-border bg-card-strong"
          : "border-transparent hover:bg-white/10"
      )}
    >
      <span
        className={cn(
          "relative flex aspect-video items-center justify-center overflow-hidden rounded-sm",
          dark ? "bg-sand-900 text-white/40" : "bg-sand-950 text-white/50"
        )}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <VideoIcon
            aria-hidden="true"
            strokeWidth={1.5}
            className={dark ? "size-5.5" : "size-7"}
          />
        )}
        {dark ? (
          <StatusDot status={status} className="absolute top-1.5 right-1.5" />
        ) : (
          <StatusBadge
            status={status}
            className="absolute top-2 right-2 gap-1.5 bg-white/90 px-2 py-0.5 text-micro [&>span]:size-1.75"
          />
        )}
        {selected && !dark ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink px-2 py-0.5 text-micro text-ink-foreground">
            Affiché
          </span>
        ) : null}
      </span>

      {dark ? (
        <span className="flex justify-between gap-1.5 px-0.5 text-xs whitespace-nowrap">
          <b className="truncate font-semibold">{session.driver}</b>
          <span className="text-white/70">{STATUS_LABEL[status]}</span>
        </span>
      ) : (
        <span className="flex min-w-0 flex-col px-1 pb-0.5">
          <span className="truncate text-sm font-semibold">
            {session.driver} · {station.station_id}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {session.track}
          </span>
        </span>
      )}
    </Link>
  )
}
