import { createDataTableColumns, DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { Sample } from "@/contracts/telemetry"
import {
  activeEvents,
  type ActiveEvent,
  type RaceEvent,
} from "@/features/direct/history"
import { describeEvent, isYellowEvent } from "@/features/direct/rows"
import { formatDecimal, formatLapTime, NOT_AVAILABLE } from "@/lib/format"

/** Libelle, precede d'un carre `flag-yellow` pour un drapeau jaune (jamais la couleur seule). */
function EventLabel({ event }: { event: ActiveEvent }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {isYellowEvent(event) ? (
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px] bg-flag-yellow" />
      ) : null}
      {describeEvent(event)}
    </span>
  )
}

const seconds = (s: number) => `${formatDecimal(s, 1)}\u00a0s`

/** Penalite : temps annonce par ACC. Drapeau : duree d'affichage, une fois leve. */
function eventTime(event: RaceEvent): string {
  if (event.kind === "penalty") {
    return event.penaltyTimeS == null ? NOT_AVAILABLE : seconds(event.penaltyTimeS)
  }
  return event.endedAt == null
    ? NOT_AVAILABLE
    : seconds((event.endedAt - event.startedAt) / 1000)
}

const column = createDataTableColumns<RaceEvent>()

const eventColumns = column.columns([
  column.accessor("lap", { header: "Tour", enableSorting: false }),
  column.accessor("lapTimeMs", {
    header: "Moment",
    enableSorting: false,
    cell: (info) => formatLapTime(info.getValue()),
  }),
  column.display({
    id: "type",
    header: "Type",
    cell: (info) => <EventLabel event={info.row.original} />,
  }),
  column.display({
    id: "time",
    header: "Temps correspondant",
    cell: (info) => eventTime(info.row.original),
  }),
  column.display({
    id: "state",
    header: "État",
    cell: (info) => {
      const event = info.row.original
      if (event.endedAt == null) {
        return (
          <Badge variant="warning" className="px-2.5 py-0.5">
            En cours
          </Badge>
        )
      }
      return (
        <Badge variant="secondary" className="px-2.5 py-0.5">
          {event.kind === "penalty" ? "Purgée" : "Levé"}
        </Badge>
      )
    },
  }),
])

/** Etat actuel : un drapeau ou une penalite par pastille, le vert compris. */
function CurrentState({ sample }: { sample: Sample }) {
  if (sample.flag == null && sample.penalty_code == null && sample.track_flags == null) {
    return <p className="text-caption text-muted-foreground">État actuel : {NOT_AVAILABLE}, non transmis par l'agent.</p>
  }
  const active = activeEvents(sample)
  const green = sample.track_flags?.includes("green") ?? false
  return (
    <ul aria-label="État actuel" className="flex flex-wrap gap-2">
      {green ? (
        <li>
          <Badge variant="success" className="px-3">
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            Drapeau vert
          </Badge>
        </li>
      ) : null}
      {active.map((event) => (
        <li key={`${event.kind}:${event.code}`}>
          <Badge variant={event.kind === "penalty" ? "danger" : "secondary"} className="px-3">
            <EventLabel event={event} />
          </Badge>
        </li>
      ))}
      {!green && active.length === 0 ? (
        <li>
          <Badge variant="secondary" className="px-3">
            Aucun drapeau ni pénalité
          </Badge>
        </li>
      ) : null}
    </ul>
  )
}

/** Drapeaux et penalites (maquette 2) : etat actuel, puis historique depuis l'ouverture de la page. */
export function EventsCard({
  sample,
  events,
}: {
  sample: Sample
  events: RaceEvent[]
}) {
  return (
    <Card className="px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-card-title">Pénalités et drapeaux</h2>
          <Badge variant="info" className="px-2.5 py-0.5">
            Codes non vérifiés
          </Badge>
        </div>
        <span className="text-caption text-muted-foreground">
          Du plus récent au plus ancien
        </span>
      </div>
      <CurrentState sample={sample} />
      <DataTable
        columns={eventColumns}
        data={events}
        getRowId={(row) => row.id}
        emptyMessage="Aucune pénalité ni drapeau reçu depuis l'ouverture de la page."
      />
      <p className="text-meta text-muted-foreground">
        Codes lus dans ACC (flag, penalty, penaltyTime, drapeaux globaux) mais jamais vus
        pendant une vraie pénalité (décision 0016) : un code inconnu s'affiche avec son numéro.
      </p>
    </Card>
  )
}
