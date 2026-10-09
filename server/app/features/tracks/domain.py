from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

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


class PieceReason(StrEnum):
    """Pourquoi un morceau de tracé est enregistré avant la fin du tour."""

    SECTOR = "sector"  # le joueur franchit un secteur (checkpoint) du circuit
    PAUSE = "pause"  # le jeu est mis en pause
    PIT_ENTRY = "pit_entry"  # le joueur entre dans la voie des stands
    LAP_END = "lap_end"  # passage de la ligne: dernier morceau du tour
    STOPPED = "stopped"  # session ACC arretee (statut off ou replay)
    SIZE_LIMIT = "size_limit"  # garde-fou: morceau trop long (secteur qui ne change jamais)


@dataclass(frozen=True)
class PieceCandidate:
    """Un morceau de trace ferme, pas encore valide ni enregistre."""

    station_id: str
    run_id: str
    track: str
    car: str
    lap_number: int
    piece_index: int
    reason: PieceReason
    sector: int | None
    points: tuple[LapPoint, ...]

    @property
    def start_ms(self) -> int:
        return self.points[0].t_ms


@dataclass(frozen=True)
class PieceSummary:
    piece_id: Slug
    track: Slug
    station_id: str
    car: str
    lap_number: int
    piece_index: int
    reason: PieceReason
    sector: int | None
    start_pos: float
    end_pos: float
    point_count: int
    length_m: float
    recorded_at: datetime


@dataclass(frozen=True)
class Piece:
    """Un morceau de tour enregistre: trace allegee (un point tous les quelques metres)."""

    summary: PieceSummary
    run_id: str
    points: tuple[TracePoint, ...]


@dataclass(frozen=True)
class TrackSummary:
    track: Slug
    lap_count: int
    best_lap_ms: int | None
    piece_count: int = 0
