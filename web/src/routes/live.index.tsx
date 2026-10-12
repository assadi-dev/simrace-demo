import { useRef, type CSSProperties } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { PhaseBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { MuteButton, ProtocolToggle } from "@/features/live/live-controls"
import { LiveTile } from "@/features/live/live-tile"
import { useGridTop } from "@/features/live/use-grid-top"
import { useLiveFeed } from "@/features/live/use-live-feed"
import { useNow } from "@/hooks/use-now"

export const Route = createFileRoute("/live/")({
  component: LivePage,
})

/*
 * Mosaique : 1 colonne sur telephone, 2 des sm, 3 des lg, 4 des xl. Une tuile prend la largeur
 * de sa colonne, plafonnee des sm pour que deux rangees tiennent toujours dans la fenetre (les
 * 4 premiers postes visibles sans defiler en 2 colonnes) ; au-dela, la page defile.
 * - hauteur visible : 100svh, moins le haut de la grille (`--grid-top`, mesure) et la marge
 *   basse de la page (6 unites) ;
 * - hors video 16/9, une tuile mesure 84 unites + 2 px de haut (padding 2 x 3, espace 3, pied
 *   12, bordures) et 6 unites + 2 px de large. `--spacing` porte deja --ui-scale ;
 * - plancher de 70 unites (210 px a l'echelle 0,75) : en dessous, les surimpressions debordent.
 */
const MOSAIC_VARS = {
  "--gap": "calc(var(--spacing) * 5)",
  "--column": "calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols))",
  "--two-rows":
    "calc(((100svh - var(--grid-top, 0px) - var(--spacing) * 6 - var(--gap)) / 2 - var(--spacing) * 21 - 2px) * 16 / 9 + var(--spacing) * 6 + 2px)",
} as CSSProperties

/**
 * Live (maquette 5) : un lecteur video par poste, telemetrie du flux en surimpression.
 * Postes et telemetrie : donnees de demo au format du serveur (features/live/mock.ts).
 */
function LivePage() {
  const feed = useLiveFeed()
  const now = useNow()
  const withVideo = feed.filter((e) => e.station.online).length
  const gridRef = useRef<HTMLDivElement>(null)
  useGridTop(gridRef)

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

      <div className="@container">
        <div
          ref={gridRef}
          style={MOSAIC_VARS}
          className="grid grid-cols-[repeat(var(--cols),var(--column))] justify-center gap-(--gap) [--cols:1] sm:grid-cols-[repeat(var(--cols),min(var(--column),max(var(--two-rows),var(--spacing)*70)))] sm:[--cols:2] lg:[--cols:3] xl:[--cols:4]"
        >
          {feed.map((entry) => (
            <LiveTile key={entry.station.station_id} entry={entry} now={now} />
          ))}
        </div>
      </div>
    </>
  )
}
