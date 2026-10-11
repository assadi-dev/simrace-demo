import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { PauseIcon, PlayIcon } from "lucide-react"
import { parseAsNumberLiteral, useQueryState } from "nuqs"

import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CurvesCard } from "@/features/direct/curves-card"
import { EventsCard } from "@/features/direct/events-card"
import { LapsCard } from "@/features/direct/laps-card"
import { PositionCard } from "@/features/direct/position-card"
import { SpeedCard } from "@/features/direct/speed-card"
import { directKpis } from "@/features/direct/values"
import { stationsQueryOptions } from "@/features/stations/queries"
import { stationStatus } from "@/features/stations/status"
import { sortStations } from "@/features/stations/summary"
import { NOT_AVAILABLE } from "@/lib/format"
import { useLiveStore } from "@/stores/live-store"

export const Route = createFileRoute("/stations/$stationId/")({
  component: DirectPage,
})

/** Fenetre des courbes, dans l'URL (?fenetre=10) : un lien partage garde la meme vue. */
const WINDOWS = [10, 30, 60] as const
const windowParser = parseAsNumberLiteral(WINDOWS).withDefault(30)

/** Choix du poste : la liste de GET /stations, plus le poste ouvert s'il n'y est pas encore. */
function StationSelect({ stationId }: { stationId: string }) {
  const stations = useQuery(stationsQueryOptions)
  const navigate = useNavigate()
  const ids = useMemo(() => {
    const known = stations.data
      ? sortStations(stations.data).map((s) => s.station_id)
      : []
    return known.includes(stationId) ? known : [stationId, ...known]
  }, [stations.data, stationId])

  return (
    <label className="flex items-center gap-2 text-caption text-muted-foreground">
      Poste
      <Select
        value={stationId}
        onValueChange={(id) =>
          void navigate({
            to: "/stations/$stationId",
            params: { stationId: id },
            search: (prev) => prev,
          })
        }
      >
        <SelectTrigger className="min-w-32 text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ids.map((id) => (
            <SelectItem key={id} value={id}>
              {id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

/**
 * Direct d'un poste (maquette 2). Tout vient du flux /stream filtre sur le poste ; GET /stations
 * donne le nom du PC et l'etat en ligne.
 */
function DirectPage() {
  const { stationId } = Route.useParams()
  const live = useLiveStore((state) => state.stations[stationId])
  const resetTrip = useLiveStore((state) => state.resetTrip)
  const [windowS, setWindowS] = useQueryState("fenetre", windowParser)
  const [frozen, setFrozen] = useState(false)
  const stations = useQuery(stationsQueryOptions)
  const station = stations.data?.find((s) => s.station_id === stationId)

  const session = live?.session ?? station?.session
  // le nom du PC vient de GET /stations : absent tant que la liste n'a pas vu le poste
  const subtitle = session
    ? [
        session.car,
        session.driver,
        ...(station ? [station.machine ?? NOT_AVAILABLE] : []),
      ].join(" · ")
    : undefined

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link
              to="/"
              className="font-medium text-primary-text underline-offset-4 hover:underline"
            >
              Postes
            </Link>{" "}
            / {stationId}
          </>
        }
        title={session ? `${stationId} · ${session.track}` : stationId}
        description={
          station || live ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {subtitle}
              <StatusBadge
                status={stationStatus(station?.online ?? true, live)}
              />
            </span>
          ) : undefined
        }
        actions={
          <>
            <StationSelect stationId={stationId} />
            <ToggleGroup
              type="single"
              aria-label="Fenêtre des courbes"
              value={String(windowS)}
              onValueChange={(value) =>
                value &&
                void setWindowS(Number(value) as (typeof WINDOWS)[number])
              }
            >
              {WINDOWS.map((w) => (
                <ToggleGroupItem key={w} value={String(w)}>
                  {w}&nbsp;s
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              variant="secondary"
              aria-pressed={frozen}
              onClick={() => setFrozen((f) => !f)}
            >
              {frozen ? (
                <PlayIcon aria-hidden="true" />
              ) : (
                <PauseIcon aria-hidden="true" />
              )}
              {frozen ? "Reprendre le direct" : "Figer les courbes"}
            </Button>
          </>
        }
      />

      {live ? (
        <>
          <div className="flex flex-wrap gap-5">
            {directKpis(live.latest, live.history).map((kpi) => (
              <KpiCard
                key={kpi.label}
                className="flex-[1_1_150px]"
                label={kpi.label}
                value={kpi.value}
                help={kpi.help}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <div className="flex min-w-0 flex-[2_1_640px] flex-col gap-5">
              <SpeedCard
                sample={live.latest}
                history={live.history}
                onResetTrip={() => resetTrip(stationId)}
              />
              <CurvesCard
                stationId={stationId}
                windowS={windowS}
                frozen={frozen}
              />
              <EventsCard sample={live.latest} events={live.history.events} />
            </div>
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
              <PositionCard
                sample={live.latest}
                track={live.session.track}
                trail={live.history.trail}
              />
              <LapsCard sample={live.latest} history={live.history} />
            </div>
          </div>
        </>
      ) : (
        <Card className="px-6">
          <CardHeader className="px-0">
            <CardTitle>Aucun échantillon reçu pour ce poste.</CardTitle>
            <CardDescription>
              Le direct s'affiche dès que l'agent envoie un lot. Le flux ne
              rejoue pas le passé : les tours et les drapeaux sont ceux vus
              depuis l'ouverture de la page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </>
  )
}
