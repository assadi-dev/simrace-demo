from app.features.ingestion.events import SamplesAccepted
from app.features.telemetry.hub import Hub


class LiveFeedService:
    """Transforme les echantillons acceptes en evenements SSE "samples" (un par lot)."""

    def __init__(self, hub: Hub) -> None:
        self._hub = hub

    def on_samples_accepted(self, event: SamplesAccepted) -> None:
        self._hub.publish(
            "samples",
            {
                "station_id": event.station_id,
                "session": event.session.model_dump(),
                "samples": [s.model_dump() for s in event.samples],
            },
        )
