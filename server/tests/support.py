"""Outils de test: horloge factice et generateurs de lots / de tours synthetiques."""

from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from math import cos, pi, sin

from app.shared.clock import Clock

SESSION = {"track": "monza", "car": "ferrari_296_gt3", "driver": "A B"}


class FakeClock(Clock):
    def __init__(self) -> None:
        self._now = datetime(2026, 10, 9, 12, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self._now

    def advance(self, seconds: float) -> None:
        self._now += timedelta(seconds=seconds)


def sample(**overrides) -> dict:
    base = {
        "t_ms": 1, "packet_id": 1, "speed_kmh": 120.0, "gas": 0.5, "brake": 0.0, "gear": 3,
        "rpm": 6000, "steer": 0.1, "status": 2, "completed_laps": 1, "lap_time_ms": 30_000,
        "last_lap_ms": 0, "best_lap_ms": 0, "sector": 0, "in_pit": False, "track_pos": 0.4,
    }
    return base | overrides


def batch(
    seq: int,
    samples: list[dict] | None = None,
    run_id: str = "run-1",
    station_id: str = "sim-1",
    **extra,
) -> dict:
    return {
        "station_id": station_id, "run_id": run_id, "seq": seq, "session": SESSION,
        "samples": samples if samples is not None else [sample()],
    } | extra


def lap_samples(
    lap: int,
    count: int = 600,
    last_lap_ms: int = 0,
    with_xz: bool = True,
    in_pit: bool = False,
    drop: Iterable[int] = (),
    radius: float = 500.0,
) -> list[dict]:
    """Un tour synthetique: une boucle circulaire parcourue de la position 0 a presque 1.

    `lap` est la valeur de completed_laps, `last_lap_ms` le temps du tour precedent (comme ACC),
    `drop` retire des indices (trou de donnees).
    """
    dropped = set(drop)
    samples = []
    for i in range(count):
        if i in dropped:
            continue
        pos = i / count
        extra = {"x": radius * cos(2 * pi * pos), "z": radius * sin(2 * pi * pos)} if with_xz else {}
        samples.append(
            sample(
                t_ms=lap * 100_000 + i * 16,
                packet_id=lap * 100_000 + i,
                completed_laps=lap,
                lap_time_ms=i * 16,
                last_lap_ms=last_lap_ms,
                track_pos=pos,
                in_pit=in_pit,
                **extra,
            )
        )
    return samples
