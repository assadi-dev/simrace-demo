from app.features.ingestion.controller import IngestionController
from app.features.ingestion.schemas import AckOut
from app.shared.api import BaseRoutes


class IngestionRoutes(BaseRoutes):
    def __init__(self, controller: IngestionController) -> None:
        self._controller = controller
        super().__init__(tags=["ingestion"])

    def _register(self) -> None:
        self.router.add_api_route(
            "/ingest/batches", self._controller.ingest, methods=["POST"], response_model=AckOut
        )
