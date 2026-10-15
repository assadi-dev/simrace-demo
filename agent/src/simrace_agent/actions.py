"""Actions de l'agent qu'on peut arreter depuis un autre thread (fenetre de l'executable).

Le `stop` est verifie a chaque echantillon: l'action se termine proprement (dernier lot envoye,
fichier ferme) au lieu d'etre tuee.
"""

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


def recording_path(folder: Path, now: datetime) -> Path:
    # un fichier par enregistrement, jamais ecrase
    return folder / f"session-{now:%Y%m%d-%H%M%S}.jsonl"
