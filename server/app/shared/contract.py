"""Contrat de donnees avec l'agent.

A garder aligne champ par champ avec agent/src/simrace_agent/models.py (decision 0009).
Ecart temporaire (decision 0011): `x` et `z` existent ici, optionnels, pas encore dans l'agent.
"""

from enum import IntEnum

from pydantic import BaseModel, Field

_MAX_LAP_MS = 3_600_000
_MAX_COORD_M = 100_000


class AccStatus(IntEnum):
    OFF = 0
    REPLAY = 1
    LIVE = 2
    PAUSE = 3


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
    # position monde en metres (plan de la piste: x et z); absentes tant que l'agent ne les envoie pas
    x: float | None = Field(default=None, ge=-_MAX_COORD_M, le=_MAX_COORD_M, allow_inf_nan=False)
    z: float | None = Field(default=None, ge=-_MAX_COORD_M, le=_MAX_COORD_M, allow_inf_nan=False)
