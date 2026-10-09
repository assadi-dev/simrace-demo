from dataclasses import dataclass

from app.shared.contract import Sample, SessionInfo
from app.shared.events import DomainEvent


@dataclass(frozen=True)
class SamplesAccepted(DomainEvent):
    """Des echantillons valides viennent d'etre acceptes. Abonnes: diffusion SSE, tracks."""

    station_id: str
    run_id: str
    machine: str | None
    session: SessionInfo
    samples: tuple[Sample, ...]
