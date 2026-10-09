from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from pydantic import ValidationError

from app.schemas import Ack, Batch, Sample, SessionInfo

ONLINE_WINDOW = timedelta(seconds=5)


@dataclass
class Station:
    station_id: str
    run_id: str
    session: SessionInfo
    last_seq: int = 0
    last_seen: datetime | None = None
    batches: int = 0
    samples: int = 0
    rejected: int = 0
    duplicates: int = 0
    gaps: int = 0  # lots manquants constates (seq saute)
    reject_reasons: Counter = field(default_factory=Counter)


class Registry:
    """Etat des postes + controle d'integrite des lots (doublons, trous, echantillons invalides)."""

    def __init__(self, clock: Callable[[], datetime] = lambda: datetime.now(UTC)) -> None:
        self._clock = clock
        self._stations: dict[str, Station] = {}

    def ingest(self, batch: Batch) -> tuple[Ack, list[Sample]]:
        station = self._stations.get(batch.station_id)
        # Un nouveau run_id = l'agent a redemarre: la numerotation repart de 1.
        if station is None or station.run_id != batch.run_id:
            station = Station(batch.station_id, batch.run_id, batch.session)
            self._stations[batch.station_id] = station

        station.last_seen = self._clock()

        if batch.seq <= station.last_seq:
            station.duplicates += 1
            return self._ack(batch, "duplicate", 0, 0), []

        if station.last_seq and batch.seq > station.last_seq + 1:
            station.gaps += batch.seq - station.last_seq - 1

        valid: list[Sample] = []
        rejected = 0
        for raw in batch.samples:
            try:
                valid.append(Sample.model_validate(raw))
            except ValidationError as exc:
                rejected += 1
                first = exc.errors()[0]
                station.reject_reasons[f"{'.'.join(map(str, first['loc']))}:{first['type']}"] += 1

        station.last_seq = batch.seq
        station.session = batch.session
        station.batches += 1
        station.samples += len(valid)
        station.rejected += rejected
        return self._ack(batch, "accepted", len(valid), rejected), valid

    def snapshot(self) -> list[dict]:
        now = self._clock()
        return [
            {
                "station_id": s.station_id,
                "run_id": s.run_id,
                "online": s.last_seen is not None and now - s.last_seen <= ONLINE_WINDOW,
                "last_seen": s.last_seen.isoformat() if s.last_seen else None,
                "session": s.session.model_dump(),
                "last_seq": s.last_seq,
                "batches": s.batches,
                "samples": s.samples,
                "rejected": s.rejected,
                "duplicates": s.duplicates,
                "gaps": s.gaps,
                "reject_reasons": dict(s.reject_reasons),
            }
            for s in self._stations.values()
        ]

    @staticmethod
    def _ack(batch: Batch, status: str, accepted: int, rejected: int) -> Ack:
        return Ack(
            station_id=batch.station_id,
            run_id=batch.run_id,
            seq=batch.seq,
            status=status,
            accepted=accepted,
            rejected=rejected,
        )
