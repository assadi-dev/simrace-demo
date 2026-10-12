import type { Sample } from "@/contracts/telemetry"

/*
 * Tours termines et leur validite (fonctions pures, testees). Deux protections, car
 * is_valid_lap seul n'a pas suffi sur un vrai jeu (tours coupes affiches valides) :
 * 1. l'invalidite est retenue sur tout le tour : un seul echantillon a faux suffit, au lieu de
 *    lire le dernier echantillon (ACC remet peut-etre le drapeau a vrai juste avant la ligne) ;
 * 2. controle par le meilleur temps d'ACC, qui ne retient que les tours valides : un tour plus
 *    rapide que ce meilleur, une fois ACC a jour, est forcement invalide.
 */

export type InvalidReason = "acc_flag" | "faster_than_acc_best"

/** Tour termine, deduit d'une hausse de completed_laps. */
export type Lap = {
  /** 1 = premier tour termine de la session. */
  number: number
  /** last_lap_ms du premier echantillon du tour suivant ; null si ACC donne 0 (inconnu). */
  timeMs: number | null
  /** null : l'agent n'envoie pas is_valid_lap. */
  valid: boolean | null
  invalidReason: InvalidReason | null
  /**
   * Controle par le meilleur temps d'ACC en cours jusqu'a cet instant (horloge de l'agent, ms) ;
   * null une fois termine. Un tour en controle n'est pas encore liste.
   */
  bestCheckUntil: number | null
}

/** Ce qu'on a vu de is_valid_lap pendant un tour. */
export type ValidityWatch = { sawInvalid: boolean; sawValue: boolean }

export type LapTracking = {
  /** Tour en cours. */
  watch: ValidityWatch
  /**
   * Dernier passage de ligne : validite du tour qu'il a ferme ; `halfway` : la voiture a depuis
   * parcouru la seconde moitie du tour ; `counted` : un tour a deja ete enregistre pour lui.
   */
  crossing: {
    closed: ValidityWatch
    halfway: boolean
    counted: boolean
  } | null
}

const FRESH: ValidityWatch = { sawInvalid: false, sawValue: false }
export const EMPTY_TRACKING: LapTracking = { watch: FRESH, crossing: null }

/** Delai laisse a ACC pour mettre a jour son meilleur temps apres la ligne. */
export const BEST_SETTLE_MS = 2000
/**
 * Le compteur et le bouclage de la position signalent le meme passage de ligne a quelques
 * echantillons d'ecart. Comme le serveur, un nouveau passage ne compte qu'apres la mi-tour :
 * entre 0,5 et 0,9 (pas au-dela, ou le compteur en avance sur la position serait compte deux fois).
 */
const HALFWAY = 0.5
const WRAP_FROM = 0.9
const WRAP_TO = 0.1
const MAX_LAPS = 200

function watchSample(watch: ValidityWatch, sample: Sample): ValidityWatch {
  if (sample.is_valid_lap == null) return watch
  const sawInvalid = watch.sawInvalid || !sample.is_valid_lap
  if (watch.sawValue && sawInvalid === watch.sawInvalid) return watch
  return { sawInvalid, sawValue: true }
}

const verdict = (watch: ValidityWatch): boolean | null =>
  watch.sawInvalid ? false : watch.sawValue ? true : null

/** Le controle par le meilleur temps d'ACC, sur le dernier tour s'il est en attente. */
function checkAgainstBest(lap: Lap, sample: Sample): Lap {
  if (lap.bestCheckUntil === null || lap.timeMs === null) return lap
  const best = sample.best_lap_ms
  // ACC a retenu ce tour (ou un tour plus rapide) : rien a redire
  if (best > 0 && best <= lap.timeMs) return { ...lap, bestCheckUntil: null }
  if (sample.t_ms < lap.bestCheckUntil) return lap
  // delai ecoule, ACC garde un meilleur temps plus lent que ce tour : il ne l'a pas retenu
  if (best > 0 && lap.timeMs < best) {
    return {
      ...lap,
      valid: false,
      invalidReason: "faster_than_acc_best",
      bestCheckUntil: null,
    }
  }
  // meilleur temps inconnu (0) : pas de conclusion
  return { ...lap, bestCheckUntil: null }
}

/**
 * Fait avancer les tours d'un echantillon. `previous` est le dernier echantillon retenu.
 * Le passage de ligne est reconnu par le compteur ou par le bouclage de track_pos (ACC ne compte
 * pas le tour de sortie des stands : sans le bouclage, sa validite passerait au premier tour).
 */
export function advanceLaps(
  laps: Lap[],
  tracking: LapTracking,
  previous: Sample | undefined,
  sample: Sample
): { laps: Lap[]; tracking: LapTracking } {
  let { watch, crossing } = tracking

  const counterUp =
    previous !== undefined && sample.completed_laps > previous.completed_laps
  const wrapped =
    previous !== undefined &&
    previous.track_pos >= WRAP_FROM &&
    sample.track_pos <= WRAP_TO
  // un nouveau passage : aucun avant, mi-tour franchie depuis, ou compteur deja servi par
  // le precedent (deux hausses du compteur sont toujours deux tours)
  const isNew =
    crossing === null || crossing.halfway || (counterUp && crossing.counted)
  if ((counterUp || wrapped) && isNew) {
    crossing = { closed: watch, halfway: false, counted: false }
    watch = FRESH
  } else if (
    crossing !== null &&
    !crossing.halfway &&
    sample.track_pos >= HALFWAY &&
    sample.track_pos < WRAP_FROM
  ) {
    crossing = { ...crossing, halfway: true }
  }
  // cet echantillon appartient au tour en cours (le nouveau, apres un passage de ligne)
  watch = watchSample(watch, sample)

  let next = laps
  const last = laps.at(-1)
  if (last?.bestCheckUntil != null) {
    const checked = checkAgainstBest(last, sample)
    if (checked !== last) next = [...laps.slice(0, -1), checked]
  }

  if (counterUp && crossing !== null) {
    const timeMs = sample.last_lap_ms || null
    const valid = verdict(crossing.closed)
    const lap: Lap = {
      number: sample.completed_laps,
      timeMs,
      valid,
      invalidReason: valid === false ? "acc_flag" : null,
      // seul un tour valide est controle : un tour inconnu ou invalide est masque de toute facon
      bestCheckUntil:
        valid === true && timeMs !== null ? sample.t_ms + BEST_SETTLE_MS : null,
    }
    next = [...next, checkAgainstBest(lap, sample)].slice(-MAX_LAPS)
    crossing = { ...crossing, counted: true }
  }

  const nextTracking =
    watch === tracking.watch && crossing === tracking.crossing
      ? tracking
      : { watch, crossing }
  return { laps: next, tracking: nextTracking }
}
