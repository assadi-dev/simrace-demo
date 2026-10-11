import { ACC_STATUS, type Sample, type TrackFlag } from "@/contracts/telemetry"

/*
 * Historique d'un poste, deduit du flux echantillon par echantillon (fonctions pures, testees).
 * Le flux ne rejoue pas le passe : tout ce qui est ici a ete vu depuis l'ouverture de la page.
 */

/** Tour termine, deduit d'une hausse de completed_laps. */
export type Lap = {
  /** 1 = premier tour termine de la session. */
  number: number
  /** last_lap_ms du premier echantillon du tour suivant ; null si ACC donne 0 (inconnu). */
  timeMs: number | null
  /** is_valid_lap du dernier echantillon du tour ; null si l'agent ne l'envoie pas. */
  valid: boolean | null
}

/** Drapeau ou penalite actif dans un echantillon. */
export type ActiveEvent = (
  | { kind: "penalty"; code: number }
  | { kind: "flag"; code: number }
  | { kind: "track_flag"; code: TrackFlag }
) & {
  /** Penalite en temps annoncee par ACC (s) ; null pour un drapeau ou si ACC donne 0. */
  penaltyTimeS: number | null
}

/** Drapeau ou penalite : ouvert quand il apparait dans un echantillon, ferme quand il disparait. */
export type RaceEvent = ActiveEvent & {
  id: string
  /** Tour (1 = premier) et temps dans le tour a l'apparition. */
  lap: number
  lapTimeMs: number
  startedAt: number
  /** null = toujours actif. */
  endedAt: number | null
}

/** Distance integree a partir de la vitesse, en roulant (statut live) uniquement. */
export type Trip = { distanceM: number; drivenMs: number }

export type StationHistory = {
  laps: Lap[]
  /** Plus recent d'abord. */
  events: RaceEvent[]
  trip: Trip
}

export const EMPTY_HISTORY: StationHistory = {
  laps: [],
  events: [],
  trip: { distanceM: 0, drivenMs: 0 },
}

/** Au-dela, deux echantillons ne sont pas consecutifs (lots perdus, pause) : on n'integre pas. */
export const MAX_STEP_MS = 1000
const MAX_LAPS = 200
const MAX_EVENTS = 50

/**
 * Drapeaux et penalites actifs dans un echantillon. Le drapeau vert (etat normal) n'est pas un
 * evenement ; le jaune global n'est garde que si aucun jaune de secteur ne le precise.
 */
export function activeEvents(sample: Sample): ActiveEvent[] {
  const active: ActiveEvent[] = []
  if (sample.penalty_code) {
    active.push({
      kind: "penalty",
      code: sample.penalty_code,
      penaltyTimeS: sample.penalty_time_s || null,
    })
  }
  if (sample.flag) {
    active.push({ kind: "flag", code: sample.flag, penaltyTimeS: null })
  }
  const flags = sample.track_flags ?? []
  const sectorYellow = flags.some((f) => f.startsWith("yellow_"))
  for (const flag of flags) {
    if (flag === "green" || (flag === "yellow" && sectorYellow)) continue
    active.push({ kind: "track_flag", code: flag, penaltyTimeS: null })
  }
  return active
}

/** Identite d'un evenement : meme type et meme code = le meme drapeau ou la meme penalite. */
const eventKey = (event: ActiveEvent) => `${event.kind}:${event.code}`

function advanceEvents(events: RaceEvent[], sample: Sample): RaceEvent[] {
  const active = activeEvents(sample)
  const activeKeys = new Set(active.map(eventKey))
  const openKeys = new Set(
    events.filter((e) => e.endedAt === null).map(eventKey)
  )

  let changed = false
  // un evenement ouvert qui n'est plus dans l'echantillon est termine
  let next = events.map((event) => {
    if (event.endedAt !== null || activeKeys.has(eventKey(event))) return event
    changed = true
    return { ...event, endedAt: sample.t_ms }
  })
  const opened: RaceEvent[] = []
  for (const event of active) {
    const key = eventKey(event)
    if (openKeys.has(key)) continue
    opened.push({
      ...event,
      id: `${key}@${sample.t_ms}`,
      lap: sample.completed_laps + 1,
      lapTimeMs: sample.lap_time_ms,
      startedAt: sample.t_ms,
      endedAt: null,
    })
  }
  if (opened.length > 0) {
    changed = true
    next = [...opened, ...next].slice(0, MAX_EVENTS)
  }
  return changed ? next : events
}

function advanceTrip(trip: Trip, previous: Sample, sample: Sample): Trip {
  const dt = sample.t_ms - previous.t_ms
  const live =
    previous.status === ACC_STATUS.live && sample.status === ACC_STATUS.live
  if (!live || dt <= 0 || dt > MAX_STEP_MS) return trip
  // trapeze : vitesse moyenne entre les deux echantillons (km/h -> m/s)
  const metersPerSecond = (previous.speed_kmh + sample.speed_kmh) / 2 / 3.6
  return {
    distanceM: trip.distanceM + (metersPerSecond * dt) / 1000,
    drivenMs: trip.drivenMs + dt,
  }
}

/**
 * Fait avancer l'historique d'un echantillon. `previous` est le dernier echantillon retenu
 * (t_ms strictement plus petit, le store ecarte les autres).
 * completed_laps qui recule = nouvelle session ou agent redemarre : on repart de zero.
 */
export function advanceHistory(
  history: StationHistory,
  previous: Sample | undefined,
  sample: Sample
): StationHistory {
  if (previous && sample.completed_laps < previous.completed_laps) {
    return advanceHistory(EMPTY_HISTORY, undefined, sample)
  }

  let laps = history.laps
  if (previous && sample.completed_laps > previous.completed_laps) {
    laps = [
      ...laps,
      {
        number: sample.completed_laps,
        timeMs: sample.last_lap_ms || null,
        valid: previous.is_valid_lap ?? null,
      },
    ].slice(-MAX_LAPS)
  }

  const events = advanceEvents(history.events, sample)
  const trip = previous ? advanceTrip(history.trip, previous, sample) : history.trip

  if (laps === history.laps && events === history.events && trip === history.trip) {
    return history
  }
  return { laps, events, trip }
}
