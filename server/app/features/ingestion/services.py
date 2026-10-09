from app.features.ingestion.events import SamplesAccepted
from app.features.ingestion.schemas import AckOut, BatchIn
from app.features.ingestion.validation import SampleValidator
from app.features.stations.domain import BatchDisposition
from app.features.stations.services import StationService
from app.shared.events import EventBus


class IngestionService:
    """Recoit un lot: controle d'integrite (doublon, trou), validation, puis evenement."""

    def __init__(
        self, stations: StationService, validator: SampleValidator, event_bus: EventBus
    ) -> None:
        self._stations = stations
        self._validator = validator
        self._event_bus = event_bus

    def ingest(self, batch: BatchIn) -> AckOut:
        station = self._stations.begin_or_resume(
            batch.station_id, batch.run_id, batch.session, batch.machine
        )

        if station.register_batch(batch.seq) is BatchDisposition.DUPLICATE:
            self._stations.save(station)
            return self._ack(batch, "duplicate", 0, 0)

        outcome = self._validator.validate(batch.samples)
        station.record_samples(len(outcome.valid), outcome.rejected, outcome.reasons)
        station.update_session(batch.session)
        self._stations.save(station)

        if outcome.valid:
            self._event_bus.publish(
                SamplesAccepted(
                    station_id=batch.station_id,
                    run_id=batch.run_id,
                    machine=station.machine,
                    session=batch.session,
                    samples=tuple(outcome.valid),
                )
            )
        return self._ack(batch, "accepted", len(outcome.valid), outcome.rejected)

    @staticmethod
    def _ack(batch: BatchIn, status: str, accepted: int, rejected: int) -> AckOut:
        return AckOut(
            station_id=batch.station_id,
            run_id=batch.run_id,
            seq=batch.seq,
            status=status,
            accepted=accepted,
            rejected=rejected,
        )
