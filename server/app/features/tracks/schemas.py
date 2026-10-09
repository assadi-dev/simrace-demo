from datetime import datetime

from pydantic import BaseModel

from app.features.tracks.domain import Lap, LapSummary, TrackSummary
from app.features.tracks.services import RecorderStats


class TrackSummaryOut(BaseModel):
    track: str
    lap_count: int
    best_lap_ms: int | None

    @classmethod
    def from_summary(cls, summary: TrackSummary) -> "TrackSummaryOut":
        return cls(
            track=str(summary.track), lap_count=summary.lap_count, best_lap_ms=summary.best_lap_ms
        )


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

    @classmethod
    def from_stats(cls, stats: RecorderStats, enabled: bool) -> "RecorderStatusOut":
        return cls(
            enabled=enabled,
            laps_saved=stats.saved,
            duplicate_laps=stats.duplicates,
            rejected=dict(stats.rejected),
            discarded=dict(stats.discarded),
        )
