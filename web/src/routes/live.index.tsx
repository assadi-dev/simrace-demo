import type { CSSProperties } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { PageHeader } from "@/components/page-header"
import { PhaseBadge } from "@/components/status-badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProtocolToggle } from "@/features/live/live-controls"
import { LiveTile } from "@/features/live/live-tile"
import { useTopOffset } from "@/features/live/use-top-offset"
import { useLiveFeed } from "@/features/live/use-live-feed"
import { useNow } from "@/hooks/use-now"

export const Route = createFileRoute("/live/")({
  component: LivePage,
})

/*
 * Mosaique : 1 colonne sur telephone, 2 des sm, 3 des lg, 4 des xl. Une tuile prend la largeur
 * de sa colonne, plafonnee des sm pour que deux rangees tiennent toujours dans la fenetre (les
 * 4 premiers postes visibles sans defiler en 2 colonnes) ; au-dela, la page defile.
 * - hauteur visible : 100svh, moins le haut de la grille (`--top-offset`, mesure) et la marge
 *   basse de la page (6 unites) ;
 * - hors video 16/9, une tuile mesure 84 unites + 2 px de haut (padding 2 x 3, espace 3, pied
 *   12, bordures) et 6 unites + 2 px de large. `--spacing` porte deja --ui-scale ;
 * - plancher de 70 unites (210 px a l'echelle 0,75) : en dessous, les surimpressions debordent.
 */
const MOSAIC_VARS = {
  "--gap": "calc(var(--spacing) * 5)",
  "--column": "calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols))",
  "--two-rows":
    "calc(((100svh - var(--top-offset, 0px) - var(--spacing) * 6 - var(--gap)) / 2 - var(--spacing) * 21 - 2px) * 16 / 9 + var(--spacing) * 6 + 2px)",
} as CSSProperties

/** Accord au pluriel : `s` au-dela de 1. */
const s = (count: number) => (count > 1 ? "s" : "")

/**
 * Live (maquette 5) : un apercu par poste (premiere image du flux, sans son), telemetrie du
 * flux /stream en surimpression. La video en direct est dans la vue en grand et le plein ecran.
 */
function LivePage() {
  const { feed, query } = useLiveFeed()
  const now = useNow()
  const withVideo = feed.filter((e) => e.station.online).length
  const gridRef = useTopOffset()

  return (
    <>
      <PageHeader
        title="Live"
        badges={<PhaseBadge />}
        description={
          query.data
            ? `${feed.length} poste${s(feed.length)}, ${withVideo} flux vidéo attendu${s(withVideo)} (postes en ligne ou en pause)`
            : undefined
        }
        actions={<ProtocolToggle />}
      />

      {query.isPending ? (
        <p className="px-1 text-muted-foreground">Chargement des postes…</p>
      ) : query.isError ? (
        <Card className="px-6">
          <CardHeader className="px-0">
            <CardTitle>Serveur injoignable</CardTitle>
            <CardDescription>{query.error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : feed.length === 0 ? (
        <Card className="px-6">
          <CardHeader className="px-0">
            <CardTitle>Aucun poste déclaré</CardTitle>
            <CardDescription>
              Un poste apparaît dès que l'agent envoie son premier lot.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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
