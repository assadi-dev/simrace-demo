from itertools import pairwise
from math import hypot
from typing import ClassVar

from app.features.tracks.domain import (
    Lap,
    LapCandidate,
    LapSummary,
    Piece,
    PieceCandidate,
    PieceSummary,
    TracePoint,
)
from app.features.tracks.strategy import (
    AllRulesStrategy,
    BestLapTimeStrategy,
    EndsAtLineRule,
    ForwardProgressRule,
    HasCoordinatesRule,
    KnownLapTimeRule,
    LapValidationStrategy,
    LatestLapStrategy,
    MinimumPointsRule,
    NoDataGapRule,
    NoPitRule,
    ReferenceSelectionStrategy,
    ResamplingStrategy,
    StartsAtLineRule,
)
from app.shared.clock import Clock
from app.shared.slug import Slug


class LapFactory:
    """Transforme un tour candidat valide en tour enregistrable (identifiants surs, trace reduite)."""

    def __init__(self, resampler: ResamplingStrategy, clock: Clock) -> None:
        self._resampler = resampler
        self._clock = clock

    def create(self, candidate: LapCandidate, track: Slug) -> Lap:
        points = self._resampler.resample(candidate.points)
        station = Slug.from_untrusted(candidate.station_id, max_length=24)
        run = Slug.from_untrusted(candidate.run_id, max_length=12)
        summary = LapSummary(
            lap_id=Slug(f"{station}-{run}-lap{candidate.lap_number:03d}"),
            track=track,
            station_id=candidate.station_id,
            car=candidate.car,
            lap_number=candidate.lap_number,
            lap_time_ms=candidate.lap_time_ms,
            recorded_at=self._clock.now(),
            length_m=round(self._loop_length(points), 1),
        )
        return Lap(summary=summary, run_id=candidate.run_id, points=points)

    @staticmethod
    def _loop_length(points: tuple[TracePoint, ...]) -> float:
        """Longueur de la boucle fermee."""
        return sum(
            hypot(b[0] - a[0], b[1] - a[1])
            for a, b in zip(points, [*points[1:], points[0]], strict=True)
        )


class ValidationStrategyFactory:
    @staticmethod
    def default() -> LapValidationStrategy:
        return AllRulesStrategy(
            [
                MinimumPointsRule(),
                HasCoordinatesRule(),
                StartsAtLineRule(),
                EndsAtLineRule(),
                NoPitRule(),
                NoDataGapRule(),
                ForwardProgressRule(),
                KnownLapTimeRule(),
            ]
        )


    @staticmethod
    def for_pieces() -> LapValidationStrategy:
        """Un morceau n'a ni depart ni arrivee sur la ligne: seules les regles de continuite."""
        return AllRulesStrategy(
            [MinimumPointsRule(30), HasCoordinatesRule(), NoDataGapRule(), ForwardProgressRule()]
        )


class PieceFactory:
    """Transforme un morceau candidat valide en morceau enregistrable."""

    def __init__(self, thinner: ResamplingStrategy, clock: Clock) -> None:
        self._thinner = thinner
        self._clock = clock

    def create(self, candidate: PieceCandidate, track: Slug) -> Piece:
        points = self._thinner.resample(candidate.points)
        station = Slug.from_untrusted(candidate.station_id, max_length=24)
        run = Slug.from_untrusted(candidate.run_id, max_length=12)
        summary = PieceSummary(
            # le debut du morceau (horloge de l'agent) rend l'identifiant stable: un morceau
            # rejoue apres un redemarrage du serveur retombe sur le meme fichier
            piece_id=Slug(f"{station}-{run}-p{candidate.start_ms}"),
            track=track,
            station_id=candidate.station_id,
            car=candidate.car,
            lap_number=candidate.lap_number,
            piece_index=candidate.piece_index,
            reason=candidate.reason,
            sector=candidate.sector,
            start_pos=candidate.points[0].track_pos,
            end_pos=candidate.points[-1].track_pos,
            point_count=len(points),
            length_m=round(sum(hypot(b[0] - a[0], b[1] - a[1]) for a, b in pairwise(points)), 1),
            recorded_at=self._clock.now(),
        )
        return Piece(summary=summary, run_id=candidate.run_id, points=points)


class ReferenceStrategyFactory:
    _STRATEGIES: ClassVar[dict[str, type[ReferenceSelectionStrategy]]] = {
        BestLapTimeStrategy.name: BestLapTimeStrategy,
        LatestLapStrategy.name: LatestLapStrategy,
    }

    @classmethod
    def create(cls, name: str) -> ReferenceSelectionStrategy:
        try:
            return cls._STRATEGIES[name]()
        except KeyError:
            raise ValueError(f"strategie de reference inconnue: {name}") from None
