"""Actions de l'agent qu'on peut arreter depuis un autre thread (fenetre de l'executable).

Le `stop` est verifie a chaque echantillon: l'action se termine proprement (dernier lot envoye,
fichier ferme) au lieu d'etre tuee.
"""

import json
import threading
import time
from datetime import datetime
from pathlib import Path

from simrace_agent.sender import BatchSender
from simrace_agent.sources.base import Source
from simrace_agent.sources.replay import Recorder


def stream(source: Source, sender: BatchSender, batch_ms: int, stop: threading.Event) -> None:
    """Envoie les echantillons au serveur par lots de `batch_ms` jusqu'au `stop`."""
    sender.start()
    batch: list[dict] = []
    deadline = time.monotonic() + batch_ms / 1000
    try:
        for sample in source.samples():
            if stop.is_set():
                break
            batch.append(sample.to_dict())
            if time.monotonic() >= deadline:
                sender.submit(source.session(), batch)
                batch, deadline = [], time.monotonic() + batch_ms / 1000
        sender.submit(source.session(), batch)
    finally:
        sender.close()
    print(f"[agent] envoi termine (perdus: {sender.dropped}, refuses: {sender.refused})")


def record(source: Source, path: Path, stop: threading.Event) -> int:
    """Enregistre la session dans `path` jusqu'au `stop`. Renvoie le nombre d'echantillons."""
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    for _ in Recorder(source, path).samples():
        count += 1
        if stop.is_set():
            break
    print(f"[agent] replay enregistre: {path} ({count} echantillons)")
    return count


REPLAY_SUFFIXES = (".jsonl", ".json")  # seuls fichiers proposes et acceptes pour un rejeu


def list_replays(folder: Path, extra: Path | None = None) -> list[tuple[Path, str]]:
    """Replays du dossier, du plus recent au plus ancien, avec un libelle pour la liste.

    `extra` est un fichier choisi ailleurs (bouton Parcourir), ajoute s'il est valide.
    Un fichier qui n'est pas un enregistrement simrace est ignore.
    """
    paths = sorted(folder.glob("*.json*")) if folder.is_dir() else []
    if extra is not None and extra not in paths:
        paths.append(extra)
    found = []
    for path in paths:
        info = replay_info(path)
        if info is not None:
            found.append((info[0], path, info[1]))
    found.sort(key=lambda item: item[0], reverse=True)
    return [(path, label) for _, path, label in found]


def replay_info(path: Path) -> tuple[datetime, str] | None:
    """Date et libelle d'un replay, None si ce n'est pas un enregistrement simrace.

    Seule la premiere ligne est lue (circuit, voiture): un gros fichier ne ralentit pas la liste.
    """
    if path.suffix.lower() not in REPLAY_SUFFIXES:
        return None
    try:
        with path.open(encoding="utf-8") as fh:
            session = json.loads(fh.readline() or "{}").get("session")
        modified = datetime.fromtimestamp(path.stat().st_mtime).astimezone()
    except (OSError, ValueError, AttributeError):
        return None
    if not isinstance(session, dict):
        return None
    track, car = session.get("track") or "n.d.", session.get("car") or "n.d."
    return modified, f"{modified:%d/%m %H:%M}  {track}  {car}  ({path.name})"


def recording_path(folder: Path, now: datetime) -> Path:
    # un fichier par enregistrement, jamais ecrase
    return folder / f"session-{now:%Y%m%d-%H%M%S}.jsonl"
