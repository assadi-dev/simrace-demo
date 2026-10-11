import os
from pathlib import Path

DEFAULT_SERVER_URL = "http://localhost:8000"


def load_env_file(path: Path) -> None:
    # lit KEY=VALUE ligne par ligne, sans ecraser une variable deja definie dans l'environnement
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def server_url() -> str:
    return os.environ.get("SIMRACE_SERVER_URL", DEFAULT_SERVER_URL)


def station_id(fallback: str) -> str:
    return os.environ.get("SIMRACE_STATION_ID", fallback)
