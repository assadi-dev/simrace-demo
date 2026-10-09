from pathlib import Path

import pytest
from pydantic import ValidationError

from app.shared.config import Settings


def test_defaults():
    settings = Settings.from_env({})
    assert settings.online_window_s == 5.0
    assert settings.record_tracks is True
    assert settings.reference_strategy == "best_time"
    assert settings.data_dir == Path("data")


def test_reads_environment_variables():
    settings = Settings.from_env(
        {
            "SIMRACE_CORS_ORIGINS": "http://a.test, http://b.test",
            "SIMRACE_DATA_DIR": "/tmp/simrace",
            "SIMRACE_ONLINE_WINDOW_S": "10",
            "SIMRACE_RECORD_TRACKS": "false",
            "SIMRACE_REFERENCE_STRATEGY": "latest",
            "SIMRACE_TRACK_POINTS": "500",
        }
    )
    assert settings.cors_origins == ["http://a.test", "http://b.test"]
    assert settings.online_window_s == 10
    assert settings.record_tracks is False
    assert settings.reference_strategy == "latest"
    assert settings.track_points == 500


@pytest.mark.parametrize(
    "env",
    [
        {"SIMRACE_REFERENCE_STRATEGY": "random"},
        {"SIMRACE_TRACK_POINTS": "5"},
        {"SIMRACE_ONLINE_WINDOW_S": "0"},
    ],
)
def test_invalid_values_fail_at_startup(env):
    with pytest.raises(ValidationError):
        Settings.from_env(env)
