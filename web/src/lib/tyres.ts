import { formatNumber, NOT_AVAILABLE } from "@/lib/format"

/** Quatre valeurs par roue, dans l'ordre du contrat (decision 0013). */
export type PerWheel = readonly [number, number, number, number]

export type TyreReading = {
  /** Position lisible, pour les lecteurs d'ecran. */
  wheel: string
  /** Position abregee affichee. */
  short: string
  temperature: string
}

/** Meme ordre que le contrat (perWheel) : avant gauche, avant droit, arriere gauche, arriere droit. */
const WHEELS = [
  { wheel: "Avant gauche", short: "AVG" },
  { wheel: "Avant droit", short: "AVD" },
  { wheel: "Arrière gauche", short: "ARG" },
  { wheel: "Arrière droit", short: "ARD" },
] as const

/** Temperature de chaque pneu en °C arrondie a l'entier ; `n.d.` si l'agent ne l'envoie pas. */
export function tyreTemperatures(
  temps: PerWheel | null | undefined
): TyreReading[] {
  return WHEELS.map(({ wheel, short }, i) => {
    const celsius = temps?.[i]
    return {
      wheel,
      short,
      temperature:
        celsius == null ? NOT_AVAILABLE : formatNumber(Math.round(celsius)),
    }
  })
}
