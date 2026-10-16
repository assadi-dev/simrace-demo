import { NOT_AVAILABLE } from "@/lib/format"
import { type PerWheel, tyreTemperatures } from "@/lib/tyres"
import { cn } from "@/lib/utils"
import { TyresIcon } from "@/shared/icons/tyres-icon"

/**
 * Temperature des quatre pneus (decision 0013), autour d'une voiture vue de dessus : l'avant
 * en haut, comme le widget pneus d'ACC. Mini-carte autonome, reutilisable (direct d'un poste,
 * page Live). Une valeur absente s'affiche n.d.
 */
export function TyreTemps({
  temps,
  className,
}: {
  temps: PerWheel | null | undefined
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center gap-1 rounded-lg border border-card-border bg-card-inner px-5 py-4",
        className
      )}
    >
      <h3 className="text-label whitespace-nowrap text-muted-foreground">
        Température des pneus
      </h3>
      <div className="relative py-1">
        <TyresIcon className="absolute top-1/2 left-1/2 h-14 -translate-x-1/2 -translate-y-1/2 text-primary-text" />
        {/* colonne de gauche alignee a gauche, colonne de droite a droite : l'icone au milieu */}
        <ul className="grid grid-cols-2 gap-x-14 gap-y-3">
          {tyreTemperatures(temps).map((tyre, i) => (
            <li
              key={tyre.short}
              aria-label={`${tyre.wheel} : ${tyre.temperature}`}
              className={cn(
                "flex flex-col",
                i % 2 === 1 && "items-end text-right"
              )}
            >
              <span
                aria-hidden="true"
                className="text-meta text-muted-foreground"
              >
                {tyre.short}
              </span>
              <span
                aria-hidden="true"
                className="flex items-baseline gap-1 whitespace-nowrap"
              >
                <span className="text-metric-sm">{tyre.temperature}</span>
                {tyre.temperature === NOT_AVAILABLE ? null : (
                  <span className="text-caption text-muted-foreground">°C</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-meta text-muted-foreground">
        {temps == null ? "Non transmis par l'agent" : "Lues dans ACC"}
      </p>
    </div>
  )
}
