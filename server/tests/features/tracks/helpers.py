from datetime import UTC, datetime

from app.features.ingestion.events import SamplesAccepted
from app.features.tracks.domain import Lap, LapCandidate, LapPoint, LapSummary
from app.shared.contract import Sample, SessionInfo
from app.shared.slug import Slug

SESSION = SessionInfo(track="monza", car="ferrari_296_gt3", driver="A B")


def points(
    count: int = 600,
    start: float = 0.0,
    end: float = 0.998,
    step_ms: int = 16,
    with_xz: bool = True,
    in_pit_at: int | None = None,
) -> list[LapPoint]:
    out = []
    for i in range(count):
        pos = start + (end - start) * i / (count - 1)
        out.append(
            LapPoint(
                t_ms=i * step_ms,
                track_pos=pos,
                lap_time_ms=i * step_ms,
                in_pit=(i == in_pit_at),
                x=pos * 1000 if with_xz else None,
                z=pos * 500 if with_xz else None,
            )
        )
    return out


def candidate(pts: list[LapPoint] | None = None, lap_time_ms: int = 9600, **overrides) -> LapCandidate:
    base = {
        "station_id": "sim-1", "run_id": "run-1", "track": "monza", "car": "ferrari_296_gt3",
        "lap_number": 1, "lap_time_ms": lap_time_ms,
        "points": tuple(pts if pts is not None else points()),
    }
    return LapCandidate(**(base | overrides))


def accepted(raw_samples: list[dict], station_id: str = "sim-1", run_id: str = "run-1",
             session: SessionInfo = SESSION) -> SamplesAccepted:
    return SamplesAccepted(
        station_id=station_id, run_id=run_id, machine=None, session=session,
        samples=tuple(Sample.model_validate(s) for s in raw_samples),
    )


def piece(piece_id: str = "sim-1-run-1-p1000", track: str = "monza", reason: str = "sector",
          minute: int = 0, pts: tuple = ((0.0, 0.0), (5.0, 0.0), (10.0, 0.0))):
    from app.features.tracks.domain import Piece, PieceReason, PieceSummary

    summary = PieceSummary(
        piece_id=Slug(piece_id), track=Slug(track), station_id="sim-1", car="c", lap_number=0,
        piece_index=0, reason=PieceReason(reason), sector=0, start_pos=0.0, end_pos=0.1,
        point_count=len(pts), length_m=10.0,
        recorded_at=datetime(2026, 10, 9, 12, minute, tzinfo=UTC),
    )
    return Piece(summary=summary, run_id="run-1", points=pts)


def lap(lap_id: str = "sim-1-run-1-lap001", lap_time_ms: int = 9600, minute: int = 0,
        track: str = "monza", pts: tuple = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0))) -> Lap:
    summary = LapSummary(
        lap_id=Slug(lap_id), track=Slug(track), station_id="sim-1", car="c", lap_number=1,
        lap_time_ms=lap_time_ms, recorded_at=datetime(2026, 10, 9, 12, minute, tzinfo=UTC),
        length_m=3.4,
    )
    return Lap(summary=summary, run_id="run-1", points=pts)
