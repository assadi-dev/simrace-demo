from datetime import datetime

from pydantic import BaseModel

from app.features.stations.domain import Station
from app.shared.contract import SessionInfo


class StationOut(BaseModel):
    station_id: str
    machine: str | None
    run_id: str
    online: bool
    last_seen: datetime | None
    session: SessionInfo
    last_seq: int
    batches: int
    samples: int
    rejected: int
    duplicates: int
    gaps: int
    reject_reasons: dict[str, int]

    @classmethod
    def from_station(cls, station: Station, online: bool) -> "StationOut":
        return cls(
            station_id=station.station_id,
            machine=station.machine,
            run_id=station.run_id,
            online=online,
            last_seen=station.last_seen,
            session=station.session,
            last_seq=station.last_seq,
            batches=station.batches,
            samples=station.samples,
            rejected=station.rejected,
            duplicates=station.duplicates,
            gaps=station.gaps,
            reject_reasons=station.reject_reasons,
        )
