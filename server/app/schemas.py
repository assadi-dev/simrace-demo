from typing import Literal

from pydantic import BaseModel, Field

_MAX_LAP_MS = 3_600_000


class SessionInfo(BaseModel):
    track: str = Field(max_length=64)
    car: str = Field(max_length=64)
    driver: str = Field(max_length=128)


class Sample(BaseModel):
    t_ms: int = Field(ge=0)
    packet_id: int = Field(ge=0)
    speed_kmh: float = Field(ge=0, le=500)
    gas: float = Field(ge=0, le=1)
    brake: float = Field(ge=0, le=1)
    gear: int = Field(ge=-1, le=9)
    rpm: int = Field(ge=0, le=20_000)
    steer: float = Field(ge=-10, le=10)
    status: int = Field(ge=0, le=3)
    completed_laps: int = Field(ge=0)
    lap_time_ms: int = Field(ge=0, le=_MAX_LAP_MS)
    last_lap_ms: int = Field(ge=0, le=_MAX_LAP_MS)
    best_lap_ms: int = Field(ge=0, le=_MAX_LAP_MS)
    sector: int = Field(ge=0, le=9)
    in_pit: bool
    track_pos: float = Field(ge=0, le=1)


class Batch(BaseModel):
    """Enveloppe d'un lot. Les echantillons sont valides un par un par le registre."""

    station_id: str = Field(min_length=1, max_length=64)
    run_id: str = Field(min_length=1, max_length=64)
    seq: int = Field(ge=1)
    session: SessionInfo
    samples: list[dict] = Field(max_length=600)


class Ack(BaseModel):
    station_id: str
    run_id: str
    seq: int
    status: Literal["accepted", "duplicate"]
    accepted: int
    rejected: int
