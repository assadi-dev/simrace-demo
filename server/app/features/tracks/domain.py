from dataclasses import dataclass
from datetime import datetime

from app.shared.slug import Slug

# Un point de trace: (x, z) en metres. Le point i d'un tour de N points est a la position i / N.
TracePoint = tuple[float, float]


@dataclass(frozen=True, slots=True)
class LapPoint:
    """Ce qu'on retient d'un echantillon pendant qu'un tour se roule (leger: 30 000 par tour)."""

    t_ms: int
    track_pos: float
    lap_time_ms: int
    in_pit: bool
    x: float | None
    z: float | None


@dataclass(frozen=True)
class LapCandidate:
    """Un tour termine, pas encore valide ni enregistre."""

    station_id: str
    run_id: str
    track: str
    car: str
    lap_number: int
    lap_time_ms: int
    points: tuple[LapPoint, ...]


@dataclass(frozen=True)
class LapSummary:
    lap_id: Slug
    track: Slug
    station_id: str
    car: str
    lap_number: int
    lap_time_ms: int
    recorded_at: datetime
    length_m: float


@dataclass(frozen=True)
class Lap:
    """Un tour valide, trace reechantillonnee. C'est ce qu'on ecrit, un fichier par tour."""

    summary: LapSummary
    run_id: str
    points: tuple[TracePoint, ...]


@dataclass(frozen=True)
class TrackSummary:
    track: Slug
    lap_count: int
    best_lap_ms: int | None
