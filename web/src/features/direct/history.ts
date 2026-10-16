import type { Sample, TrackFlag } from "@/contracts/telemetry"
import {
  advanceLaps,
  EMPTY_TRACKING,
  type Lap,
  type LapTracking,
} from "@/features/direct/laps"

export type { Lap } from "@/features/direct/laps"

/*
 * Historique d'un poste, deduit du flux echantillon par echantillon (fonctions pures, testees).
 * Le flux ne rejoue pas le passe : tout ce qui est ici a ete vu depuis l'ouverture de la page.
 */

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

/** Point roule (position monde en metres, decision 0011). */
export type TrailPoint = { x: number; z: number; inPit: boolean }

export type StationHistory = {
  laps: Lap[]
  /** Validite observee pendant le tour en cours et dernier passage de ligne (laps.ts). */
  lapTracking: LapTracking
  /** Plus recent d'abord. */
  events: RaceEvent[]
  /** Trace roulee du tour en cours ; vide si l'agent n'envoie pas x et z. */
  trail: TrailPoint[]
}

export const EMPTY_HISTORY: StationHistory = {
  laps: [],
  lapTracking: EMPTY_TRACKING,
  events: [],
  trail: [],
}

/** Au-dela, deux echantillons ne sont pas consecutifs (lots perdus, pause) : les courbes coupent. */
export const MAX_STEP_MS = 1000
const MAX_EVENTS = 50
/** Un point de trace tous les 2 m : environ 2 500 points pour un tour de 5 km. */
export const TRAIL_STEP_M = 2
const MAX_TRAIL = 6000
/** Passage de ligne reconnu par la position, comme le serveur (tour de sortie non compte par ACC). */
const WRAP_FROM = 0.9
const WRAP_TO = 0.1

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

function advanceTrail(
  trail: TrailPoint[],
  previous: Sample | undefined,
  sample: Sample
): TrailPoint[] {
  if (sample.x == null || sample.z == null) return trail
  const point = { x: sample.x, z: sample.z, inPit: sample.in_pit }
  const newLap =
    previous !== undefined &&
    (sample.completed_laps > previous.completed_laps ||
      (previous.track_pos >= WRAP_FROM && sample.track_pos <= WRAP_TO))
  if (newLap) return [point]

  const last = trail.at(-1)
  if (
    last &&
    last.inPit === point.inPit &&
    Math.hypot(point.x - last.x, point.z - last.z) < TRAIL_STEP_M
  ) {
    return trail
  }
  return [...trail, point].slice(-MAX_TRAIL)
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

  const { laps, tracking: lapTracking } = advanceLaps(
    history.laps,
    history.lapTracking,
    previous,
    sample
  )

  const events = advanceEvents(history.events, sample)
  const trail = advanceTrail(history.trail, previous, sample)

  if (
    laps === history.laps &&
    lapTracking === history.lapTracking &&
    events === history.events &&
    trail === history.trail
  ) {
    return history
  }
  return { laps, lapTracking, events, trail }
}
