import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { PhaseBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { MuteButton, ProtocolToggle } from "@/features/live/live-controls"
import { LiveTile } from "@/features/live/live-tile"
import { useLiveFeed } from "@/features/live/use-live-feed"
import { useNow } from "@/hooks/use-now"

export const Route = createFileRoute("/live/")({
  component: LivePage,
})

/**
 * Live (maquette 5) : un lecteur video par poste, telemetrie du flux en surimpression.
 * Postes et telemetrie : donnees de demo au format du serveur (features/live/mock.ts).
 */
function LivePage() {
  const feed = useLiveFeed()
  const now = useNow()
  const withVideo = feed.filter((e) => e.station.online).length

  return (
    <>
      <PageHeader
        title="Live"
        badges={
          <>
            <PhaseBadge />
            <Badge variant="secondary">Données de démo</Badge>
          </>
        }
        description={`${feed.length} postes, ${withVideo} flux vidéo attendus (postes en ligne ou en pause)`}
        actions={
          <>
            <ProtocolToggle />
            <MuteButton />
          </>
        }
      />

      {/*
        Des sm, les 4 tuiles tiennent dans la fenetre (2 x 2, sans defiler) : le conteneur prend
        la hauteur restante sous l'en-tete (unites cqw/cqh) et une tuile mesure le plus petit de
        - la moitie de la largeur, moins la moitie de l'espace gap-5 (2,5 unites) ;
        - la largeur ou deux rangees tiennent en hauteur. Hors video 16/9, une tuile a une
          hauteur fixe de 84 unites x echelle + 2 px (padding 2 x 3, espace 3, pied 12 unites,
          bordures), et 6 unites + 2 px en largeur. `--spacing` porte deja --ui-scale.
        Le conteneur est une couche absolue : la hauteur d'un element flex sous un min-h-svh
        n'est pas "definie" et Chrome y resout cqh a 0.
        Sur telephone : une colonne, la page defile.
      */}
      <div className="sm:relative sm:min-h-120 sm:flex-1">
        <div className="sm:@container-size sm:absolute sm:inset-0">
          <div className="grid gap-5 sm:grid-cols-[repeat(2,var(--tile-w))] sm:justify-center sm:[--tile-w:min(calc(50cqw-var(--spacing)*2.5),calc((50cqh-var(--spacing)*23.5-2px)*16/9+var(--spacing)*6+2px))]">
            {feed.map((entry) => (
              <LiveTile
                key={entry.station.station_id}
                entry={entry}
                now={now}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
