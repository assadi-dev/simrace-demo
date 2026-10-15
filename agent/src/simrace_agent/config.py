import os
from pathlib import Path

DEFAULT_SERVER_URL = "http://localhost:8000"
DEFAULT_SOURCE = "acc"


def executable_dir(executable: Path) -> Path:
    # dossier ou l'exe est pose; sous macOS l'executable est dans X.app/Contents/MacOS/:
    # on remonte a cote du .app pour ne jamais ecrire dans le bundle
    folder = executable.parent
    if folder.name == "MacOS" and folder.parent.name == "Contents":
        bundle = folder.parent.parent
        if bundle.suffix == ".app":
            return bundle.parent
    return folder


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


def game_source() -> str:
    # jeu lu en direct (acc ou acevo); --source le remplace en ligne de commande
    return os.environ.get("SIMRACE_SOURCE", DEFAULT_SOURCE).strip().lower()
