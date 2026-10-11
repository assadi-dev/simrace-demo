import type { ReactNode } from "react"
import { RouteIcon, ThermometerIcon } from "lucide-react"

import { formatTemperature } from "@/lib/format"

/** Mini-carte de temperature (design.md 8 : TemperatureChip). */
function TemperatureChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number | null | undefined
}) {
  return (
    <div className="flex flex-[1_1_140px] items-center gap-2.5 rounded-md border border-card-border bg-card-inner px-3.5 py-2.5 whitespace-nowrap">
      {icon}
      <div className="flex flex-col">
        <span className="text-meta text-muted-foreground">{label}</span>
        <span className="text-card-title">{formatTemperature(value)}</span>
      </div>
    </div>
  )
}

/**
 * Temperatures de l'air et de la piste (decision 0016), icones thermometer et route
 * (design.md 9). Une valeur absente s'affiche n.d. `compact` : libelles courts, pour que les
 * deux tiennent cote a cote dans une carte etroite (page Postes).
 */
export function WeatherChips({
  air,
  road,
  compact = false,
}: {
  air: number | null | undefined
  road: number | null | undefined
  compact?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <TemperatureChip
        icon={
          <ThermometerIcon
            aria-hidden="true"
            className="size-5.5 text-primary-text"
          />
        }
        label={compact ? "Air" : "Température de l'air"}
        value={air}
      />
      <TemperatureChip
        icon={
          <RouteIcon
            aria-hidden="true"
            className="size-5.5 text-primary-text"
          />
        }
        label={compact ? "Piste" : "Température de la piste"}
        value={road}
      />
    </div>
  )
}
