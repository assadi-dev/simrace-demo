import { RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Sample } from "@/contracts/telemetry"
import type { StationHistory } from "@/features/direct/history"
import { SpeedGauge } from "@/features/direct/speed-gauge"
import { gaugeStats } from "@/features/direct/values"

/** Vitesse (maquette 2) : rapport, distance et moyenne a gauche, jauge et regime a droite. */
export function SpeedCard({
  sample,
  history,
  onResetTrip,
}: {
  sample: Sample
  history: StationHistory
  /** Remet a zero la distance et la vitesse moyenne. */
  onResetTrip: () => void
}) {
  return (
    <Card className="gap-4 px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-card-title">Vitesse</h2>
        <span className="text-eyebrow text-primary-text">
          Source : flux /stream, dernier échantillon
        </span>
      </div>
      <div className="flex flex-wrap items-stretch gap-5">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
          <dl className="flex flex-1 flex-col justify-between gap-2">
            {gaugeStats(sample, history).map((stat) => (
              <div
                key={stat.label}
                className="flex flex-1 flex-col justify-center gap-1 rounded-lg border border-card-border bg-card-inner px-5 py-4"
              >
                <dt className="text-label whitespace-nowrap text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-metric">{stat.value}</span>
                  {stat.unit ? (
                    <span className="text-caption text-muted-foreground">
                      {stat.unit}
                    </span>
                  ) : null}
                </dd>
                <dd className="text-meta text-muted-foreground">{stat.help}</dd>
              </div>
            ))}
          </dl>
          <Button
            variant="secondary"
            size="sm"
            onClick={onResetTrip}
            disabled={history.trip.drivenMs === 0}
            className="self-start"
          >
            <RotateCcwIcon aria-hidden="true" />
            Remettre à zéro distance et moyenne
          </Button>
        </div>
        <SpeedGauge speedKmh={sample.speed_kmh} rpm={sample.rpm} />
      </div>
    </Card>
  )
}
