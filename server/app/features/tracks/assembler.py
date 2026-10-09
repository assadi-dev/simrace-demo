from dataclasses import dataclass

from app.features.tracks.domain import LapCandidate, LapPoint
from app.shared.contract import AccStatus, Sample, SessionInfo


@dataclass(frozen=True)
class AssemblyResult:
    """Soit un tour termine (candidate), soit la raison pour laquelle on a abandonne le tour en cours."""

    candidate: LapCandidate | None = None
    discarded_reason: str | None = None


class LapAssembler:
    """Reconstitue les tours d'un poste (pour un run_id) a partir du flux d'echantillons.

    Un tour se termine au passage de la ligne, reconnu de deux facons:
    - `completed_laps` augmente de 1;
    - la position `track_pos` boucle (de la fin vers le debut du circuit). Necessaire car ACC ne
      compte pas le tour de sortie des stands: le compteur reste a 0 alors que la ligne est passee
      (observe sur un vrai jeu).
    Un saut ou un retour en arriere du compteur (session relancee, lots perdus) abandonne le tour
    en cours. Seuls les echantillons en conduite (statut LIVE) comptent: pause et replay sont
    ignores. `lap_number` est l'ordre des tours depuis le debut du run, pas le compteur d'ACC.
    """

    MAX_POINTS = 150_000  # environ 40 minutes a 60 Hz: protege la memoire d'un tour qui ne finit pas
    CATCH_UP_POINTS = 30  # un compteur qui avance juste apres un passage de ligne deja traite
    HALFWAY = 0.5  # le bouclage de position ne compte qu'apres la moitie du tour
    WRAP_FROM = 0.9
    WRAP_TO = 0.1

    def __init__(self, station_id: str, run_id: str) -> None:
        self.station_id = station_id
        self.run_id = run_id
        self._counter: int | None = None
        self._ordinal = 0
        self._points: list[LapPoint] = []
        self._halfway = False

    def push(self, sample: Sample, session: SessionInfo) -> AssemblyResult | None:
        if sample.status != AccStatus.LIVE:
            return None

        point = LapPoint(
            t_ms=sample.t_ms,
            track_pos=sample.track_pos,
            lap_time_ms=sample.lap_time_ms,
            in_pit=sample.in_pit,
            x=sample.x,
            z=sample.z,
        )

        if self._counter is None:
            self._start(sample.completed_laps, point)
            return None

        same_counter = sample.completed_laps == self._counter
        counter_advanced = sample.completed_laps == self._counter + 1

        if counter_advanced and len(self._points) < self.CATCH_UP_POINTS:
            # le compteur rattrape un passage de ligne deja detecte par la position
            self._counter = sample.completed_laps
            return self._append(point)

        wrapped = (
            self._halfway
            and self._points[-1].track_pos >= self.WRAP_FROM
            and sample.track_pos <= self.WRAP_TO
        )
        if counter_advanced or (same_counter and wrapped):
            return AssemblyResult(candidate=self._close(sample, session, point))

        if same_counter:
            return self._append(point)

        self._start(sample.completed_laps, point)
        return AssemblyResult(discarded_reason="lap_counter_jump")

    def _append(self, point: LapPoint) -> AssemblyResult | None:
        self._points.append(point)
        self._halfway = self._halfway or point.track_pos >= self.HALFWAY
        if len(self._points) > self.MAX_POINTS:
            self._counter = None
            self._points = []
            return AssemblyResult(discarded_reason="lap_too_long")
        return None

    def _close(self, sample: Sample, session: SessionInfo, first_point: LapPoint) -> LapCandidate:
        candidate = LapCandidate(
            station_id=self.station_id,
            run_id=self.run_id,
            track=session.track,
            car=session.car,
            lap_number=self._ordinal,
            # le temps du tour termine est annonce par le premier echantillon du tour suivant;
            # sinon on prend le chrono du dernier point du tour
            lap_time_ms=sample.last_lap_ms or self._points[-1].lap_time_ms,
            points=tuple(self._points),
        )
        self._ordinal += 1
        self._start(sample.completed_laps, first_point)
        return candidate

    def _start(self, counter: int, first_point: LapPoint) -> None:
        self._counter = counter
        self._points = [first_point]
        self._halfway = first_point.track_pos >= self.HALFWAY
