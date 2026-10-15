import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"

import { StatusBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { stationsQueryOptions } from "@/features/stations/queries"
import { sortStations } from "@/features/stations/summary"
import { useNow } from "@/hooks/use-now"
import { formatAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useLiveStore, type Connection } from "@/stores/live-store"

const FLOW = {
  connected: { status: "online", label: "Flux en direct connecté" },
  connecting: { status: "paused", label: "Connexion au flux" },
  reconnecting: { status: "paused", label: "Reconnexion du flux" },
  offline: { status: "offline", label: "Flux hors ligne" },
} as const satisfies Record<
  Connection,
  { status: "online" | "paused" | "offline"; label: string }
>

const navClass = cn(
  buttonVariants({ variant: "ghost" }),
  "data-[status=active]:bg-ink data-[status=active]:font-semibold data-[status=active]:text-ink-foreground"
)

/**
 * En-tete (maquettes) : marque, onglets en pilules (l'actif en `ink`), etat du flux SSE et
 * fraicheur de la liste des postes. Direct vise le poste ouvert, sinon le premier poste de la
 * liste (en ligne d'abord).
 */
export function AppHeader() {
  const connection = useLiveStore((state) => state.connection)
  const flow = FLOW[connection]
  const stations = useQuery(stationsQueryOptions)
  const params = useParams({ strict: false })
  const now = useNow()

  const stationId =
    params.stationId ??
    (stations.data ? sortStations(stations.data)[0]?.station_id : undefined)

  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-card-border bg-card px-6 py-4">
      <Link
        to="/"
        className="flex flex-col gap-0.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="text-brand">SimRace</span>
        <span className="text-caption text-muted-foreground">
          Centre de simulation · démo
        </span>
      </Link>

      <nav aria-label="Navigation principale" className="flex grow flex-wrap gap-2">
        <Link to="/" activeOptions={{ exact: true }} className={navClass}>
          Postes
        </Link>
        {stationId ? (
          <Link
            to="/stations/$stationId"
            params={{ stationId }}
            activeOptions={{ exact: true }}
            className={navClass}
          >
            Direct
          </Link>
        ) : (
          // aucun poste connu : rien a ouvrir
          <span
            aria-disabled="true"
            title="Aucun poste déclaré"
            className={cn(navClass, "pointer-events-none opacity-50")}
          >
            Direct
          </span>
        )}
        <Link to="/leaderboard" className={navClass}>
          Leaderboard
        </Link>
        <Link to="/live" className={navClass}>
          Live
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <div role="status" aria-live="polite">
          <StatusBadge status={flow.status} label={flow.label} className="py-1.5" />
        </div>
        {stations.dataUpdatedAt ? (
          <span className="text-meta text-muted-foreground">
            Liste mise à jour {formatAgo(now - stations.dataUpdatedAt)}
          </span>
        ) : null}
      </div>
    </header>
  )
}
