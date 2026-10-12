import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { LiveChart, type ChartSeries } from "@/features/direct/live-chart"

const SPEED: ChartSeries[] = [
  {
    key: "speed",
    label: "Vitesse (km/h)",
    colorVar: "--color-chart-1",
    fill: true,
  },
]
const PEDALS: ChartSeries[] = [
  { key: "gas", label: "Accélérateur (%)", colorVar: "--color-chart-3" },
  { key: "brake", label: "Frein (%)", colorVar: "--color-chart-2" },
]

/** Axe de vitesse : de 0 au maximum visible arrondi a 50 km/h, au moins 100. */
const speedRange = (max: number): [number, number] => [
  0,
  Math.max(100, Math.ceil(max / 50) * 50),
]
const pedalRange = (): [number, number] => [0, 100]

/**
 * Courbes en direct (FRONT.md) : vitesse, accelerateur et frein sur la fenetre choisie.
 * La fenetre (10, 30, 60 s) et le gel se commandent depuis le titre de la page.
 */
export function CurvesCard({
  stationId,
  windowS,
  frozen,
}: {
  stationId: string
  windowS: number
  frozen: boolean
}) {
  return (
    <Card className="gap-4 px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-card-title">Courbes</h2>
          {frozen ? (
            <Badge variant="warning" className="px-2.5 py-0.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-[2px] bg-warning"
              />
              Figées
            </Badge>
          ) : null}
        </div>
        <span className="text-eyebrow text-primary-text">
          {windowS} dernières secondes
        </span>
      </div>
      <LiveChart
        stationId={stationId}
        windowS={windowS}
        frozen={frozen}
        series={SPEED}
        height={180}
        yRange={speedRange}
        label={`Courbe de vitesse sur les ${windowS} dernières secondes`}
      />
      <LiveChart
        stationId={stationId}
        windowS={windowS}
        frozen={frozen}
        series={PEDALS}
        height={120}
        yRange={pedalRange}
        label={`Courbes d'accélérateur et de frein sur les ${windowS} dernières secondes`}
      />
      <p className="text-meta text-muted-foreground">
        Pause ACC : rien n'est ajouté. Lots perdus ou coupure du flux : la ligne
        s'interrompt.
      </p>
    </Card>
  )
}
