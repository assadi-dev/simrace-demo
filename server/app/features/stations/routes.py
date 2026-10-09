from app.features.stations.controller import StationController
from app.features.stations.schemas import StationOut
from app.shared.api import BaseRoutes


class StationRoutes(BaseRoutes):
    def __init__(self, controller: StationController) -> None:
        self._controller = controller
        super().__init__(tags=["stations"])

    def _register(self) -> None:
        self.router.add_api_route(
            "/stations", self._controller.list_stations, methods=["GET"],
            response_model=list[StationOut],
        )
        self.router.add_api_route(
            "/stations/{station_id}", self._controller.get_station, methods=["GET"],
            response_model=StationOut,
        )
