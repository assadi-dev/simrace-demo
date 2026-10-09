from app.features.stations.schemas import StationOut
from app.features.stations.services import StationService


class StationController:
    """Methodes `async`: elles s'executent sur la boucle d'evenements, comme l'ingestion qui
    modifie le meme etat (un `def` simple serait execute dans un autre thread)."""

    def __init__(self, service: StationService) -> None:
        self._service = service

    async def list_stations(self) -> list[StationOut]:
        return [StationOut.from_station(s.station, s.online) for s in self._service.list_stations()]

    async def get_station(self, station_id: str) -> StationOut:
        status = self._service.get_station(station_id)
        return StationOut.from_station(status.station, status.online)
