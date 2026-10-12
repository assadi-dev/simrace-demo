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

      {/* 560 px minimum par tuile (maquette) : 2 colonnes sur un ecran de 1360 px */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,560px),1fr))] gap-5">
        {feed.map((entry) => (
          <LiveTile key={entry.station.station_id} entry={entry} now={now} />
        ))}
      </div>
    </>
  )
}
