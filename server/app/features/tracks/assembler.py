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

    Un tour se termine quand `completed_laps` augmente de 1. Un saut ou un retour en arriere du
    compteur (session relancee, lots perdus) abandonne le tour en cours. Seuls les echantillons en
    conduite (statut LIVE) comptent: la pause et le replay sont ignores.
    """

    MAX_POINTS = 150_000  # environ 40 minutes a 60 Hz: protege la memoire d'un tour qui ne finit pas

    def __init__(self, station_id: str, run_id: str) -> None:
        self.station_id = station_id
        self.run_id = run_id
        self._lap_number: int | None = None
        self._points: list[LapPoint] = []

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

        if self._lap_number is None:
            self._start(sample.completed_laps, point)
            return None

        if sample.completed_laps == self._lap_number:
            self._points.append(point)
            if len(self._points) > self.MAX_POINTS:
                self._reset()
                return AssemblyResult(discarded_reason="lap_too_long")
            return None

        if sample.completed_laps == self._lap_number + 1:
            candidate = LapCandidate(
                station_id=self.station_id,
                run_id=self.run_id,
                track=session.track,
                car=session.car,
                lap_number=self._lap_number,
                # le temps du tour termine est annonce par le premier echantillon du tour suivant
                lap_time_ms=sample.last_lap_ms or self._points[-1].lap_time_ms,
                points=tuple(self._points),
            )
            self._start(sample.completed_laps, point)
            return AssemblyResult(candidate=candidate)

        self._start(sample.completed_laps, point)
        return AssemblyResult(discarded_reason="lap_counter_jump")

    def _start(self, lap_number: int, first_point: LapPoint) -> None:
        self._lap_number = lap_number
        self._points = [first_point]

    def _reset(self) -> None:
        self._lap_number = None
        self._points = []
