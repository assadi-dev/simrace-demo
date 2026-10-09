from abc import ABC, abstractmethod
from collections.abc import Sequence
from math import hypot
from typing import Protocol

from app.features.tracks.domain import LapCandidate, LapPoint, LapSummary, TracePoint
from app.shared.errors import DomainError

# --- Validation d'un tour ou d'un morceau: une regle = une raison de refus ----------------------


class HasPoints(Protocol):
    """Ce que les regles lisent: un tour candidat ou un morceau candidat."""

    @property
    def points(self) -> Sequence[LapPoint]: ...


class LapRule(ABC):
    reason: str

    @abstractmethod
    def is_satisfied(self, lap: HasPoints) -> bool: ...


class MinimumPointsRule(LapRule):
    reason = "too_few_points"

    def __init__(self, minimum: int = 300) -> None:
        self._minimum = minimum

    def is_satisfied(self, lap: HasPoints) -> bool:
        return len(lap.points) >= self._minimum


class HasCoordinatesRule(LapRule):
    reason = "no_coordinates"

    def __init__(self, min_ratio: float = 0.98) -> None:
        self._min_ratio = min_ratio

    def is_satisfied(self, lap: HasPoints) -> bool:
        if not lap.points:
            return False
        with_xz = sum(1 for p in lap.points if p.x is not None and p.z is not None)
        return with_xz / len(lap.points) >= self._min_ratio


class StartsAtLineRule(LapRule):
    """Le tour doit commencer sur la ligne: refuse le premier tour sorti des stands."""

    reason = "started_mid_lap"

    def __init__(self, max_start_pos: float = 0.02) -> None:
        self._max_start_pos = max_start_pos

    def is_satisfied(self, lap: HasPoints) -> bool:
        return bool(lap.points) and lap.points[0].track_pos <= self._max_start_pos


class EndsAtLineRule(LapRule):
    reason = "ended_before_line"

    def __init__(self, min_end_pos: float = 0.98) -> None:
        self._min_end_pos = min_end_pos

    def is_satisfied(self, lap: HasPoints) -> bool:
        return bool(lap.points) and lap.points[-1].track_pos >= self._min_end_pos


class NoPitRule(LapRule):
    reason = "pit_involved"

    def is_satisfied(self, lap: HasPoints) -> bool:
        return not any(p.in_pit for p in lap.points)


class NoDataGapRule(LapRule):
    """Refuse un tour avec un trou de donnees (lots perdus, agent coupe)."""

    reason = "data_gap"

    def __init__(self, max_gap_ms: int = 1000) -> None:
        self._max_gap_ms = max_gap_ms

    def is_satisfied(self, lap: HasPoints) -> bool:
        return all(
            cur.t_ms - prev.t_ms <= self._max_gap_ms
            for prev, cur in zip(lap.points, lap.points[1:], strict=False)
        )


class ForwardProgressRule(LapRule):
    """La position sur le tour ne recule pas (tout-droit, demi-tour, reprise depuis les stands)."""

    reason = "position_jump"

    def __init__(self, max_backward: float = 0.002) -> None:
        self._max_backward = max_backward

    def is_satisfied(self, lap: HasPoints) -> bool:
        return all(
            cur.track_pos >= prev.track_pos - self._max_backward
            for prev, cur in zip(lap.points, lap.points[1:], strict=False)
        )


class KnownLapTimeRule(LapRule):
    reason = "unknown_lap_time"

    def is_satisfied(self, lap: LapCandidate) -> bool:  # propre aux tours, pas aux morceaux
        return lap.lap_time_ms > 0


class LapValidationStrategy(ABC):
    @abstractmethod
    def first_failure(self, lap: HasPoints) -> str | None:
        """Raison du premier refus, ou None si le tour est valide."""


class AllRulesStrategy(LapValidationStrategy):
    def __init__(self, rules: Sequence[LapRule]) -> None:
        self._rules = tuple(rules)

    def first_failure(self, lap: HasPoints) -> str | None:
        return next((rule.reason for rule in self._rules if not rule.is_satisfied(lap)), None)


# --- Reechantillonnage: N points repartis sur le tour ---------------------------------------------


class ResamplingError(DomainError):
    pass


class ResamplingStrategy(ABC):
    @abstractmethod
    def resample(self, points: Sequence[LapPoint]) -> tuple[TracePoint, ...]: ...


class TrackPositionBinResampler(ResamplingStrategy):
    """Decoupe le tour en N tranches de position et garde la moyenne (x, z) de chacune.

    Une tranche vide est interpolee entre ses voisines (la boucle est circulaire).
    """

    def __init__(self, count: int) -> None:
        self._count = count

    def resample(self, points: Sequence[LapPoint]) -> tuple[TracePoint, ...]:
        n = self._count
        sums = [[0.0, 0.0, 0] for _ in range(n)]
        for p in points:
            if p.x is None or p.z is None:
                continue
            bin_ = sums[min(int(p.track_pos * n), n - 1)]
            bin_[0] += p.x
            bin_[1] += p.z
            bin_[2] += 1

        filled = [i for i in range(n) if sums[i][2]]
        if not filled:
            raise ResamplingError("aucun point avec coordonnees")
        means = {i: (sums[i][0] / sums[i][2], sums[i][1] / sums[i][2]) for i in filled}

        return tuple(self._point_at(i, means, n) for i in range(n))

    @staticmethod
    def _point_at(index: int, means: dict[int, TracePoint], n: int) -> TracePoint:
        if index in means:
            x, z = means[index]
            return round(x, 2), round(z, 2)
        back = 1
        while (index - back) % n not in means:
            back += 1
        forward = 1
        while (index + forward) % n not in means:
            forward += 1
        x0, z0 = means[(index - back) % n]
        x1, z1 = means[(index + forward) % n]
        t = back / (back + forward)
        return round(x0 + (x1 - x0) * t, 2), round(z0 + (z1 - z0) * t, 2)


class DistanceThinningResampler(ResamplingStrategy):
    """Pour un morceau: garde un point tous les `min_step_m` metres, plus toujours le dernier.

    Un morceau ne couvre qu'une partie du tour: on ne peut pas le decouper en tranches de
    position comme un tour complet.
    """

    def __init__(self, min_step_m: float) -> None:
        self._min_step_m = min_step_m

    def resample(self, points: Sequence[LapPoint]) -> tuple[TracePoint, ...]:
        with_xz = [(p.x, p.z) for p in points if p.x is not None and p.z is not None]
        if not with_xz:
            raise ResamplingError("aucun point avec coordonnees")
        kept = [with_xz[0]]
        for x, z in with_xz[1:]:
            if hypot(x - kept[-1][0], z - kept[-1][1]) >= self._min_step_m:
                kept.append((x, z))
        if kept[-1] != with_xz[-1]:
            kept.append(with_xz[-1])
        return tuple((round(x, 2), round(z, 2)) for x, z in kept)


# --- Choix de la carte de reference d'un circuit -------------------------------------------------


class ReferenceSelectionStrategy(ABC):
    name: str

    @abstractmethod
    def select(self, laps: Sequence[LapSummary]) -> LapSummary | None: ...


class BestLapTimeStrategy(ReferenceSelectionStrategy):
    name = "best_time"

    def select(self, laps: Sequence[LapSummary]) -> LapSummary | None:
        return min(laps, key=lambda lap: (lap.lap_time_ms, str(lap.lap_id)), default=None)


class LatestLapStrategy(ReferenceSelectionStrategy):
    name = "latest"

    def select(self, laps: Sequence[LapSummary]) -> LapSummary | None:
        return max(laps, key=lambda lap: (lap.recorded_at, str(lap.lap_id)), default=None)
