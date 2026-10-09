from datetime import datetime

from pydantic import BaseModel

from app.features.tracks.domain import (
    Lap,
    LapSummary,
    Piece,
    PieceReason,
    PieceSummary,
    TrackSummary,
)
from app.features.tracks.services import PieceStats, RecorderStats


class TrackSummaryOut(BaseModel):
    track: str
    lap_count: int
    best_lap_ms: int | None
    piece_count: int

    @classmethod
    def from_summary(cls, summary: TrackSummary) -> "TrackSummaryOut":
        return cls(
            track=str(summary.track),
            lap_count=summary.lap_count,
            best_lap_ms=summary.best_lap_ms,
            piece_count=summary.piece_count,
        )


class PieceSummaryOut(BaseModel):
    piece_id: str
    track: str
    station_id: str
    car: str
    lap_number: int
    piece_index: int
    reason: PieceReason  # sector, pause, pit_entry, lap_end, stopped ou size_limit
    sector: int | None
    start_pos: float
    end_pos: float
    point_count: int
    length_m: float
    recorded_at: datetime

    @classmethod
    def from_summary(cls, summary: PieceSummary) -> "PieceSummaryOut":
        return cls(
            piece_id=str(summary.piece_id), track=str(summary.track),
            station_id=summary.station_id, car=summary.car, lap_number=summary.lap_number,
            piece_index=summary.piece_index, reason=summary.reason, sector=summary.sector,
            start_pos=summary.start_pos, end_pos=summary.end_pos,
            point_count=summary.point_count, length_m=summary.length_m,
            recorded_at=summary.recorded_at,
        )


class PieceOut(PieceSummaryOut):
    """Un morceau avec sa trace: `points` = (x, z) en metres, dans l'ordre roule."""

    points: list[tuple[float, float]]

    @classmethod
    def from_piece(cls, piece: Piece) -> "PieceOut":
        base = PieceSummaryOut.from_summary(piece.summary)
        return cls(**base.model_dump(), points=list(piece.points))


class LapSummaryOut(BaseModel):
    lap_id: str
    track: str
    station_id: str
    car: str
    lap_number: int
    lap_time_ms: int
    recorded_at: datetime
    length_m: float

    @classmethod
    def from_summary(cls, summary: LapSummary) -> "LapSummaryOut":
        return cls(
            lap_id=str(summary.lap_id), track=str(summary.track), station_id=summary.station_id,
            car=summary.car, lap_number=summary.lap_number, lap_time_ms=summary.lap_time_ms,
            recorded_at=summary.recorded_at, length_m=summary.length_m,
        )


class LapOut(LapSummaryOut):
    """Un tour avec sa trace: `points[i]` = (x, z) en metres, a la position i / len(points)."""

    points: list[tuple[float, float]]

    @classmethod
    def from_lap(cls, lap: Lap) -> "LapOut":
        base = LapSummaryOut.from_summary(lap.summary)
        return cls(**base.model_dump(), points=list(lap.points))


class TrackMapOut(LapOut):
    """Carte de reference d'un circuit: le tour choisi par la strategie, avec son nom."""

    strategy: str

    @classmethod
    def from_reference(cls, lap: Lap, strategy: str) -> "TrackMapOut":
        return cls(**LapOut.from_lap(lap).model_dump(), strategy=strategy)


class RecorderStatusOut(BaseModel):
    enabled: bool
    laps_saved: int
    duplicate_laps: int
    rejected: dict[str, int]
    discarded: dict[str, int]
    pieces_enabled: bool
    pieces_saved: int
    duplicate_pieces: int
    pieces_rejected: dict[str, int]
    pieces_by_trigger: dict[str, int]

    @classmethod
    def from_stats(
        cls, stats: RecorderStats, pieces: PieceStats, enabled: bool, pieces_enabled: bool
    ) -> "RecorderStatusOut":
        return cls(
            enabled=enabled,
            laps_saved=stats.saved,
            duplicate_laps=stats.duplicates,
            rejected=dict(stats.rejected),
            discarded=dict(stats.discarded),
            pieces_enabled=pieces_enabled,
            pieces_saved=pieces.saved,
            duplicate_pieces=pieces.duplicates,
            pieces_rejected=dict(pieces.rejected),
            pieces_by_trigger=dict(pieces.by_trigger),
        )
