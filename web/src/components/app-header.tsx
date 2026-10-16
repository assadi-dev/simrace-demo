import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import {
  GaugeIcon,
  LayoutGridIcon,
  MenuIcon,
  TrophyIcon,
  VideoIcon,
} from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
 * Liens de navigation, en pilules dans l'en-tete ou en colonne dans le menu mobile. Les icones
 * ne servent que dans le menu mobile (l'en-tete suit la maquette, sans icone).
 */
function NavLinks({
  stationId,
  vertical = false,
  onNavigate,
}: {
  stationId: string | undefined
  vertical?: boolean
  /** Appele au clic sur un lien : ferme le menu mobile. */
  onNavigate?: () => void
}) {
  const item = cn(navClass, vertical && "w-full justify-start")
  const icon = (Icon: typeof GaugeIcon) =>
    vertical ? <Icon aria-hidden="true" /> : null

  return (
    <>
      <Link
        to="/"
        activeOptions={{ exact: true }}
        className={item}
        onClick={onNavigate}
      >
        {icon(LayoutGridIcon)}
        Postes
      </Link>
      {stationId ? (
        <Link
          to="/stations/$stationId"
          params={{ stationId }}
          activeOptions={{ exact: true }}
          className={item}
          onClick={onNavigate}
        >
          {icon(GaugeIcon)}
          Direct
        </Link>
      ) : (
        // aucun poste connu : rien a ouvrir
        <span
          aria-disabled="true"
          title="Aucun poste déclaré"
          className={cn(item, "pointer-events-none opacity-50")}
        >
          {icon(GaugeIcon)}
          Direct
        </span>
      )}
      <Link to="/leaderboard" className={item} onClick={onNavigate}>
        {icon(TrophyIcon)}
        Leaderboard
      </Link>
      <Link to="/live" className={item} onClick={onNavigate}>
        {icon(VideoIcon)}
        Live
      </Link>
    </>
  )
}

/**
 * En-tete (maquettes) : marque, onglets en pilules (l'actif en `ink`), etat du flux SSE et
 * fraicheur de la liste des postes. Direct vise le poste ouvert, sinon le premier poste de la
 * liste (en ligne d'abord).
 * Sous 768px : les onglets passent dans un menu lateral (bouton hamburger), le flux n'affiche
 * plus que sa pastille (le libelle reste lu par un lecteur d'ecran).
 */
export function AppHeader() {
  const connection = useLiveStore((state) => state.connection)
  const flow = FLOW[connection]
  const stations = useQuery(stationsQueryOptions)
  const params = useParams({ strict: false })
  const now = useNow()
  const [menuOpen, setMenuOpen] = useState(false)

  const stationId =
    params.stationId ??
    (stations.data ? sortStations(stations.data)[0]?.station_id : undefined)
  const freshness = stations.dataUpdatedAt
    ? `Liste mise à jour ${formatAgo(now - stations.dataUpdatedAt)}`
    : null

  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-card-border bg-card px-4 py-3 sm:px-6 sm:py-4">
      <Link
        to="/"
        className="mr-auto flex flex-col gap-0.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:mr-0"
      >
        <span className="text-brand">SimRace</span>
        <span className="text-caption text-muted-foreground">
          Centre de simulation · démo
        </span>
      </Link>

      <nav
        aria-label="Navigation principale"
        className="hidden grow flex-wrap gap-2 md:flex"
      >
        <NavLinks stationId={stationId} />
      </nav>

      <div className="flex items-center gap-3">
        <div role="status" aria-live="polite">
          <StatusBadge
            status={flow.status}
            label={flow.label}
            className="py-1.5"
            labelClassName="sr-only md:not-sr-only"
          />
        </div>
        {freshness ? (
          <span className="hidden text-meta text-muted-foreground md:inline">
            {freshness}
          </span>
        ) : null}

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Ouvrir le menu"
              className="md:hidden"
            >
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="gap-2 border-card-border">
            <SheetHeader className="gap-0.5 px-6 pt-6">
              <SheetTitle className="text-brand font-semibold">
                SimRace
              </SheetTitle>
              <SheetDescription className="text-caption">
                Centre de simulation · démo
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label="Navigation principale"
              className="flex flex-col gap-2 px-4"
            >
              <NavLinks
                stationId={stationId}
                vertical
                onNavigate={() => setMenuOpen(false)}
              />
            </nav>
            <SheetFooter className="items-start gap-2 px-6 pb-6">
              <StatusBadge
                status={flow.status}
                label={flow.label}
                className="py-1.5"
              />
              {freshness ? (
                <span className="text-meta text-muted-foreground">
                  {freshness}
                </span>
              ) : null}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
