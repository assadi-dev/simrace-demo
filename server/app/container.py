from fastapi import APIRouter

from app.features.ingestion.controller import IngestionController
from app.features.ingestion.events import SamplesAccepted
from app.features.ingestion.routes import IngestionRoutes
from app.features.ingestion.services import IngestionService
from app.features.ingestion.validation import SampleValidator
from app.features.stations.controller import StationController
from app.features.stations.factory import OnlinePolicyFactory, StationFactory
from app.features.stations.repository import InMemoryStationRepository, StationRepository
from app.features.stations.routes import StationRoutes
from app.features.stations.services import StationService
from app.features.telemetry.controller import TelemetryController
from app.features.telemetry.hub import Hub
from app.features.telemetry.routes import TelemetryRoutes
from app.features.telemetry.services import LiveFeedService
from app.features.tracks.controller import RecorderController, TrackController
from app.features.tracks.factory import (
    LapFactory,
    ReferenceStrategyFactory,
    ValidationStrategyFactory,
)
from app.features.tracks.repository import JsonLapRepository, LapRepository
from app.features.tracks.routes import TrackRoutes
from app.features.tracks.services import LapRecorderService, TrackQueryService
from app.features.tracks.strategy import TrackPositionBinResampler
from app.shared.api import HealthRoutes
from app.shared.clock import Clock, SystemClock
from app.shared.config import Settings
from app.shared.events import EventBus


class ApplicationContainer:
    """Seul endroit qui sait quelle classe concrete sert quelle interface.

    Les depots peuvent etre remplaces (tests, PostgreSQL plus tard) sans toucher aux services.
    """

    def __init__(
        self,
        settings: Settings,
        clock: Clock | None = None,
        station_repository: StationRepository | None = None,
        lap_repository: LapRepository | None = None,
    ) -> None:
        self.settings = settings
        self.clock = clock or SystemClock()
        self.event_bus = EventBus()

        # stations
        self.station_service = StationService(
            station_repository or InMemoryStationRepository(),
            StationFactory(),
            OnlinePolicyFactory.from_settings(settings),
            self.clock,
        )

        # ingestion
        self.ingestion_service = IngestionService(
            self.station_service, SampleValidator(), self.event_bus
        )

        # telemetry (diffusion en direct)
        self.hub = Hub()
        self.live_feed = LiveFeedService(self.hub)
        self.event_bus.subscribe(SamplesAccepted, self.live_feed.on_samples_accepted)

        # tracks (enregistrement et lecture des traces)
        laps = lap_repository or JsonLapRepository(settings.data_dir)
        self.lap_recorder = LapRecorderService(
            laps,
            ValidationStrategyFactory.default(),
            LapFactory(TrackPositionBinResampler(settings.track_points), self.clock),
        )
        if settings.record_tracks:
            self.event_bus.subscribe(SamplesAccepted, self.lap_recorder.on_samples_accepted)
        self.track_queries = TrackQueryService(
            laps, ReferenceStrategyFactory.create(settings.reference_strategy)
        )

    def routers(self) -> list[APIRouter]:
        return [
            HealthRoutes(lambda: self.hub.subscriber_count).router,
            IngestionRoutes(IngestionController(self.ingestion_service)).router,
            StationRoutes(StationController(self.station_service)).router,
            TelemetryRoutes(TelemetryController(self.hub)).router,
            TrackRoutes(
                TrackController(self.track_queries),
                RecorderController(self.lap_recorder, self.settings.record_tracks),
            ).router,
        ]
