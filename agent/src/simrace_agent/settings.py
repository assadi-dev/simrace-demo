"""Reglages saisis dans la fenetre (serveur, poste, dossier des replays), gardes d'un lancement
a l'autre.

Un fichier JSON dans %LOCALAPPDATA%\\simrace-agent: il survit a une reconstruction de l'exe et
se corrige a la main. Priorite: reglages enregistres, puis .env, puis valeurs par defaut.
"""

import json
import os
from pathlib import Path

FIELDS = ("server", "station", "folder")


def settings_path() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    folder = Path(base) / "simrace-agent" if base else Path.home() / ".simrace-agent"
    return folder / "settings.json"


def load(path: Path, defaults: dict[str, str]) -> dict[str, str]:
    """Valeurs enregistrees par-dessus `defaults`. Un fichier absent ou abime est ignore."""
    try:
        saved = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return dict(defaults)
    if not isinstance(saved, dict):
        return dict(defaults)
    return {
        key: saved[key] if isinstance(saved.get(key), str) and saved[key].strip() else value
        for key, value in defaults.items()
    }


def save(path: Path, values: dict[str, str]) -> None:
    # ecrit a cote puis remplace: un arret brutal ne laisse jamais un fichier a moitie ecrit
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(
        json.dumps({key: values[key].strip() for key in FIELDS}, indent=2), encoding="utf-8"
    )
    tmp.replace(path)
