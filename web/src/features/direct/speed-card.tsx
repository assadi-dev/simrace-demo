import { TyreTemps } from "@/components/tyre-temps"
import { Card } from "@/components/ui/card"
import type { Sample } from "@/contracts/telemetry"
import { SpeedGauge } from "@/features/direct/speed-gauge"
import { gearLabel } from "@/features/direct/values"

/**
 * Vitesse (maquette 2) : rapport et temperature des pneus a gauche, jauge et regime a droite.
 * Sur un ecran etroit, la jauge passe au-dessus des stats.
 */
export function SpeedCard({ sample }: { sample: Sample }) {
  return (
    <Card className="gap-4 px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-card-title">Vitesse</h2>
        <span className="text-eyebrow text-primary-text">
          Source : flux /stream, dernier échantillon
        </span>
      </div>
      {/* wrap-reverse : cote a cote, rien ne change ; empile (mobile), la jauge passe au-dessus */}
      <div className="flex flex-wrap-reverse items-stretch gap-5">
        <div className="flex min-w-0 flex-[1_1_--spacing(55)] flex-col gap-2">
          <dl className="flex flex-col justify-center gap-1 rounded-lg border border-card-border bg-card-inner px-5 py-4">
            <dt className="text-label whitespace-nowrap text-muted-foreground">
              Rapport
            </dt>
            <dd className="text-metric">{gearLabel(sample.gear)}</dd>
            <dd className="text-meta text-muted-foreground">
              Marche arrière = R, point mort = N
            </dd>
          </dl>
          <TyreTemps temps={sample.tyre_temp_c} className="flex-1" />
        </div>
        <SpeedGauge speedKmh={sample.speed_kmh} rpm={sample.rpm} />
      </div>
    </Card>
  )
}
