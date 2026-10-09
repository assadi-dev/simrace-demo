from typing import Literal

from pydantic import BaseModel, Field

from app.shared.contract import SessionInfo


class BatchIn(BaseModel):
    """Enveloppe d'un lot. Les echantillons sont valides un par un (SampleValidator)."""

    station_id: str = Field(min_length=1, max_length=64)
    machine: str | None = Field(default=None, max_length=64)  # nom du PC, informatif
    run_id: str = Field(min_length=1, max_length=64)
    seq: int = Field(ge=1)
    session: SessionInfo
    samples: list[dict] = Field(max_length=600)


class AckOut(BaseModel):
    station_id: str
    run_id: str
    seq: int
    status: Literal["accepted", "duplicate"]
    accepted: int
    rejected: int
