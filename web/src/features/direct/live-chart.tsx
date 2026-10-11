import { useEffect, useRef } from "react"
import uPlot from "uplot"
import "uplot/dist/uPlot.min.css"

import { channelsOf, type ChannelSnapshot } from "@/features/direct/channels"

/** Une serie : la colonne du tampon et la couleur (token CSS, jamais en dur). */
export type ChartSeries = {
  key: Exclude<keyof ChannelSnapshot, "x">
  label: string
  colorVar: string
  /** Aire sous la courbe, couleur de la serie a 15 %. */
  fill?: boolean
}

const FRAME_MS = 50 // 20 images par seconde (FRONT.md)

/** Graduations au format francais : -27,5 et non -27.5. */
const tickFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * Courbe uPlot alimentee par les tampons du poste (channels.ts), hors de l'etat React : le
 * graphique est cree une fois, puis redessine par requestAnimationFrame. La fenetre et le gel
 * passent par des refs pour ne pas recreer le graphique.
 */
export function LiveChart({
  stationId,
  windowS,
  frozen,
  series,
  height,
  yRange,
  label,
}: {
  stationId: string
  windowS: number
  frozen: boolean
  series: ChartSeries[]
  height: number
  /** Bornes de l'axe vertical selon le maximum visible. */
  yRange: (max: number) => [number, number]
  label: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef(windowS)
  const frozenRef = useRef(frozen)
  useEffect(() => {
    windowRef.current = windowS
    frozenRef.current = frozen
  }, [windowS, frozen])

  // series et yRange sont des constantes du parent : le graphique ne depend que du poste
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const muted = cssVar("--muted-foreground")
    const grid = cssVar("--border")
    const font = `12px ${cssVar("--font-sans") || "sans-serif"}`
    const axis = {
      stroke: muted,
      font,
      grid: { stroke: grid, width: 1 },
      ticks: { stroke: grid, width: 1 },
    }

    const chart = new uPlot(
      {
        width: container.clientWidth,
        height,
        legend: { show: false },
        cursor: { sync: { key: "direct" }, drag: { x: false, y: false } },
        scales: {
          x: { time: false, range: () => [-windowRef.current, 0] },
          y: { range: (_u, _min, max) => yRange(max ?? 0) },
        },
        axes: [
          {
            ...axis,
            space: 60,
            values: (_u, splits) =>
              splits.map((v) => `${tickFormat.format(v)}\u00a0s`),
          },
          {
            ...axis,
            // l'unite est dans la legende : des graduations courtes ne sont pas coupees
            size: 44,
            values: (_u, splits) => splits.map((v) => tickFormat.format(v)),
          },
        ],
        series: [
          {},
          ...series.map((s) => {
            const color = cssVar(s.colorVar)
            return {
              label: s.label,
              stroke: color,
              width: 2,
              fill: s.fill ? `${color}26` : undefined,
              points: { show: false },
            }
          }),
        ],
      },
      [[], ...series.map(() => [])],
      container
    )

    const resize = new ResizeObserver(() =>
      chart.setSize({ width: container.clientWidth, height })
    )
    resize.observe(container)

    let frame = 0
    let lastDraw = 0
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      if (frozenRef.current || now - lastDraw < FRAME_MS) return
      lastDraw = now
      const snapshot = channelsOf(stationId).snapshot(windowRef.current)
      chart.setData([snapshot.x, ...series.map((s) => snapshot[s.key])])
      // pour les tests e2e : nombre de points dessines, ecrit hors de React
      container.dataset.points = String(snapshot.x.length)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      chart.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, height])

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-0.5 w-4 rounded-full"
              style={{ backgroundColor: `var(${s.colorVar})` }}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div
        ref={containerRef}
        role="img"
        aria-label={label}
        data-points="0"
        className="w-full min-w-0"
      />
    </div>
  )
}
