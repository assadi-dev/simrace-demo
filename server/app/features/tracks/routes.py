from app.features.tracks.controller import RecorderController, TrackController
from app.features.tracks.schemas import (
    LapOut,
    LapSummaryOut,
    RecorderStatusOut,
    TrackMapOut,
    TrackSummaryOut,
)
from app.shared.api import BaseRoutes


class TrackRoutes(BaseRoutes):
    def __init__(self, tracks: TrackController, recorder: RecorderController) -> None:
        self._tracks = tracks
        self._recorder = recorder
        super().__init__(tags=["tracks"])

    def _register(self) -> None:
        add = self.router.add_api_route
        add("/tracks", self._tracks.list_tracks, methods=["GET"], response_model=list[TrackSummaryOut])
        add("/tracks/{track}/reference", self._tracks.get_reference, methods=["GET"],
            response_model=TrackMapOut)
        add("/tracks/{track}/laps", self._tracks.list_laps, methods=["GET"],
            response_model=list[LapSummaryOut])
        add("/tracks/{track}/laps/{lap_id}", self._tracks.get_lap, methods=["GET"],
            response_model=LapOut)
        add("/recorder/status", self._recorder.status, methods=["GET"],
            response_model=RecorderStatusOut)
