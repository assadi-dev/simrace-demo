"""Contrat de donnees avec l'agent.

A garder aligne champ par champ avec agent/src/simrace_agent/models.py (decision 0009).
`x`, `z` (0011), pneus et freins (0013), carburant et aides (0014), forces G (0015), drapeaux (0016) sont optionnels.
"""

import math
from enum import IntEnum
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

_MAX_LAP_MS = 3_600_000
_MAX_COORD_M = 100_000

# Drapeaux globaux d'ACC (a garder alignes avec agent codes.TRACK_FLAGS)
_TRACK_FLAGS = frozenset(
    {"yellow", "yellow_s1", "yellow_s2", "yellow_s3", "white", "green", "chequered", "red"}
)

# Quatre mesures (avant gauche, avant droit, arriere gauche, arriere droit), chacune bornee.
_PerWheel = Annotated[list[float], Field(min_length=4, max_length=4)]


def _check_range(values: list[float] | None, low: float, high: float) -> list[float] | None:
    if values is not None and not all(math.isfinite(v) and low <= v <= high for v in values):
        raise ValueError(f"valeur hors de [{low}, {high}]")
    return values


class AccStatus(IntEnum):
    OFF = 0
    REPLAY = 1
    LIVE = 2
    PAUSE = 3


class SessionInfo(BaseModel):
    track: str = Field(max_length=64)
    car: str = Field(max_length=64)
    driver: str = Field(max_length=128)
    fuel_capacity_l: float | None = Field(default=None, ge=0, le=1000, allow_inf_nan=False)


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
    # pneus et freins: 4 valeurs par mesure (decision 0013)
    tyre_pressure_psi: _PerWheel | None = Field(default=None)
    tyre_temp_c: _PerWheel | None = Field(default=None)
    brake_temp_c: _PerWheel | None = Field(default=None)
    pad_life_mm: _PerWheel | None = Field(default=None)
    disc_life_mm: _PerWheel | None = Field(default=None)

    @field_validator("tyre_pressure_psi", "pad_life_mm", "disc_life_mm")
    @classmethod
    def _positive_small(cls, values: list[float] | None) -> list[float] | None:
        return _check_range(values, 0, 100)

    @field_validator("tyre_temp_c")
    @classmethod
    def _tyre_range(cls, values: list[float] | None) -> list[float] | None:
        return _check_range(values, -50, 500)

    @field_validator("brake_temp_c")
    @classmethod
    def _brake_range(cls, values: list[float] | None) -> list[float] | None:
        return _check_range(values, -50, 2000)
    # carburant et aides (decision 0014)
    fuel_l: float | None = Field(default=None, ge=0, le=1000, allow_inf_nan=False)
    fuel_per_lap_l: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    tc_level: int | None = Field(default=None, ge=0, le=30)
    abs_level: int | None = Field(default=None, ge=0, le=30)
    # forces G (decision 0015): une voiture de course reste sous une dizaine de G
    g_lat: float | None = Field(default=None, ge=-20, le=20, allow_inf_nan=False)
    g_vert: float | None = Field(default=None, ge=-20, le=20, allow_inf_nan=False)
    g_long: float | None = Field(default=None, ge=-20, le=20, allow_inf_nan=False)
    # drapeau et penalite (decision 0016): codes d'ACC, la table de noms est cote agent et front
    flag: int | None = Field(default=None, ge=0, le=20)
    penalty_code: int | None = Field(default=None, ge=0, le=99)
    penalty_time_s: float | None = Field(default=None, ge=0, le=3600, allow_inf_nan=False)
    # reglages et etat de piste (decision 0016)
    tc_cut_level: int | None = Field(default=None, ge=0, le=30)
    engine_map: int | None = Field(default=None, ge=0, le=30)
    brake_bias: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    is_valid_lap: bool | None = None
    fuel_estimated_laps: float | None = Field(default=None, ge=0, le=10_000, allow_inf_nan=False)
    track_flags: list[str] | None = Field(default=None, max_length=len(_TRACK_FLAGS))

    @field_validator("track_flags")
    @classmethod
    def _known_flags(cls, flags: list[str] | None) -> list[str] | None:
        if flags is not None and not set(flags) <= _TRACK_FLAGS:
            raise ValueError("drapeau inconnu")
        return flags
    # meteo (decision 0016)
    air_temp_c: float | None = Field(default=None, ge=-50, le=100, allow_inf_nan=False)
    road_temp_c: float | None = Field(default=None, ge=-50, le=150, allow_inf_nan=False)
    wind_speed: float | None = Field(default=None, ge=0, le=500, allow_inf_nan=False)
    wind_direction: float | None = Field(default=None, ge=-360, le=720, allow_inf_nan=False)
