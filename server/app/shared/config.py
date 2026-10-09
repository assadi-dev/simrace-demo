import os
from collections.abc import Mapping
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Configuration du serveur, lue dans les variables d'environnement SIMRACE_*."""

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    data_dir: Path = Path("data")
    online_window_s: float = Field(default=5.0, gt=0, le=3600)
    record_tracks: bool = True
    record_pieces: bool = True  # morceaux de tour (pause, stands, secteur), en plus des tours
    reference_strategy: Literal["best_time", "latest"] = "best_time"
    track_points: int = Field(default=1000, ge=100, le=5000)

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Settings":
        env = os.environ if env is None else env
        names = {
            "SIMRACE_DATA_DIR": "data_dir",
            "SIMRACE_ONLINE_WINDOW_S": "online_window_s",
            "SIMRACE_RECORD_TRACKS": "record_tracks",
            "SIMRACE_RECORD_PIECES": "record_pieces",
            "SIMRACE_REFERENCE_STRATEGY": "reference_strategy",
            "SIMRACE_TRACK_POINTS": "track_points",
        }
        values: dict[str, object] = {field: env[name] for name, field in names.items() if name in env}
        if "SIMRACE_CORS_ORIGINS" in env:
            origins = env["SIMRACE_CORS_ORIGINS"].split(",")
            values["cors_origins"] = [o.strip() for o in origins if o.strip()]
        return cls(**values)
