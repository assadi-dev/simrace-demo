from fastapi.sse import EventSourceResponse

from app.features.telemetry.controller import TelemetryController
from app.shared.api import BaseRoutes


class TelemetryRoutes(BaseRoutes):
    def __init__(self, controller: TelemetryController) -> None:
        self._controller = controller
        super().__init__(tags=["telemetry"])

    def _register(self) -> None:
        self.router.add_api_route(
            "/stream", self._controller.stream, methods=["GET"], response_class=EventSourceResponse
        )
