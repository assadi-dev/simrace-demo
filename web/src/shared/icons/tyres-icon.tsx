import type { SVGProps } from "react"

/**
 * Voiture vue de dessus : quatre pneus relies par les essieux, l'avant en haut (comme le
 * widget pneus d'ACC). Dessine en currentColor : la couleur vient de la classe text-* du parent.
 */
export function TyresIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 56"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* essieux et chassis */}
      <path d="M12 14h16M12 42h16M20 14v28" />
      {/* pneus */}
      <g fill="currentColor" fillOpacity={0.15}>
        <rect x="2" y="5" width="10" height="18" rx="2.5" />
        <rect x="28" y="5" width="10" height="18" rx="2.5" />
        <rect x="2" y="33" width="10" height="18" rx="2.5" />
        <rect x="28" y="33" width="10" height="18" rx="2.5" />
      </g>
      {/* bandes de roulement */}
      <path d="M7 9v10M33 9v10M7 37v10M33 37v10" strokeOpacity={0.5} />
    </svg>
  )
}
