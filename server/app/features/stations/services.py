from typing import NamedTuple

from app.features.stations.domain import Station
from app.features.stations.factory import StationFactory
from app.features.stations.repository import StationRepository
from app.features.stations.strategy import OnlinePolicy
from app.shared.clock import Clock
from app.shared.contract import SessionInfo
from app.shared.errors import NotFoundError


class StationNotFoundError(NotFoundError):
    pass


class StationStatus(NamedTuple):
    station: Station
    online: bool


class StationService:
    def __init__(
        self,
        repository: StationRepository,
        factory: StationFactory,
        policy: OnlinePolicy,
        clock: Clock,
    ) -> None:
        self._repository = repository
        self._factory = factory
        self._policy = policy
        self._clock = clock

    def begin_or_resume(
        self, station_id: str, run_id: str, session: SessionInfo, machine: str | None
    ) -> Station:
        """Retrouve le poste, ou en demarre un nouveau si le run_id a change. Marque un signe de vie."""
        station = self._repository.get(station_id)
        if station is None or station.run_id != run_id:
            station = self._factory.start(station_id, run_id, session, machine)
        station.touch(self._clock.now(), machine)
        self._repository.save(station)
        return station

    def save(self, station: Station) -> None:
        self._repository.save(station)

    def list_stations(self) -> list[StationStatus]:
        now = self._clock.now()
        return [
            StationStatus(s, self._policy.is_online(s.last_seen, now))
            for s in self._repository.list_all()
        ]

    def get_station(self, station_id: str) -> StationStatus:
        station = self._repository.get(station_id)
        if station is None:
            raise StationNotFoundError(f"poste inconnu: {station_id}")
        return StationStatus(station, self._policy.is_online(station.last_seen, self._clock.now()))
