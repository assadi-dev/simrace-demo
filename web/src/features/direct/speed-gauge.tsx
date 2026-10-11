import {
  GAUGE,
  gaugeSegments,
  SPEED_GAUGE_MAX_KMH,
  type GaugeSegment,
} from "@/features/direct/geometry"
import { formatNumber } from "@/lib/format"

/** Couleur d'un segment : melange des deux tokens de son degrade (index.css). */
const segmentColor = ({ on, shade }: GaugeSegment) => {
  const [from, to] = on
    ? ["--color-gauge-on-from", "--color-gauge-on-to"]
    : ["--color-gauge-off-from", "--color-gauge-off-to"]
  return `color-mix(in srgb, var(${to}) ${Math.round(shade * 100)}%, var(${from}))`
}

/** Jauge de vitesse segmentee, regime dessous (design.md 8 : SpeedGauge). */
export function SpeedGauge({
  speedKmh,
  rpm,
}: {
  speedKmh: number
  rpm: number
}) {
  const kmh = Math.round(speedKmh)
  const labelX = (GAUGE.rIn + GAUGE.rOut) / 2
  return (
    <div className="flex aspect-square min-w-0 flex-[1_1_300px] flex-col items-center justify-center gap-1 rounded-lg border border-card-border bg-card-inner p-5">
      <svg
        viewBox="0 0 320 196"
        role="img"
        aria-label={`Jauge de vitesse de 0 à ${SPEED_GAUGE_MAX_KMH} km/h : ${kmh} km/h, ${rpm} tours par minute`}
        className="block h-auto w-full max-w-130"
      >
        {gaugeSegments(speedKmh).map((segment, i) => (
          <line
            key={i}
            x1={segment.x1.toFixed(1)}
            y1={segment.y1.toFixed(1)}
            x2={segment.x2.toFixed(1)}
            y2={segment.y2.toFixed(1)}
            strokeWidth={13}
            strokeLinecap="round"
            style={{ stroke: segmentColor(segment) }}
          />
        ))}
        <text
          x={GAUGE.cx}
          y={158}
          textAnchor="middle"
          fontSize={46}
          fontWeight={600}
          letterSpacing={-1}
          className="fill-foreground"
        >
          {kmh}
          <tspan
            fontSize={20}
            fontWeight={500}
            dx={6}
            className="fill-muted-foreground"
          >
            km/h
          </tspan>
        </text>
        <text
          x={GAUGE.cx - labelX}
          y={190}
          textAnchor="middle"
          fontSize={12}
          className="fill-muted-foreground"
        >
          0
        </text>
        <text
          x={GAUGE.cx + labelX}
          y={190}
          textAnchor="middle"
          fontSize={12}
          className="fill-muted-foreground"
        >
          {SPEED_GAUGE_MAX_KMH}
        </text>
      </svg>
      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-metric-sm">{formatNumber(rpm)}</span>
        <span className="text-caption text-muted-foreground">tr/min</span>
      </div>
    </div>
  )
}
