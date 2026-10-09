from abc import ABC, abstractmethod

from app.features.stations.domain import Station


class StationRepository(ABC):
    """Stockage des postes. L'implementation PostgreSQL (decision 0008) viendra ici."""

    @abstractmethod
    def get(self, station_id: str) -> Station | None: ...

    @abstractmethod
    def save(self, station: Station) -> None: ...

    @abstractmethod
    def list_all(self) -> list[Station]: ...


class InMemoryStationRepository(StationRepository):
    def __init__(self) -> None:
        self._stations: dict[str, Station] = {}

    def get(self, station_id: str) -> Station | None:
        return self._stations.get(station_id)

    def save(self, station: Station) -> None:
        self._stations[station.station_id] = station

    def list_all(self) -> list[Station]:
        return list(self._stations.values())
