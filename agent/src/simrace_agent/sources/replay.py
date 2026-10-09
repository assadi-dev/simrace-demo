"""Enregistrement et rejeu de sessions (JSON lines).

Premiere ligne: {"session": {...}}. Ensuite une ligne par echantillon. Le rejeu respecte la
cadence d'origine et reecrit `t_ms` avec l'heure courante.
"""

import json
import time
from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

from simrace_agent.models import Sample, SessionInfo
from simrace_agent.sources.base import Source, SourceError


class Recorder:
    """Enveloppe une source et ecrit ce qu'elle produit dans un fichier."""

    def __init__(self, source: Source, path: Path) -> None:
        self._source = source
        self._path = path

    def session(self) -> SessionInfo:
        return self._source.session()

    def samples(self) -> Iterator[Sample]:
        with self._path.open("w", encoding="utf-8") as fh:
            fh.write(json.dumps({"session": self._source.session().to_dict()}) + "\n")
            for sample in self._source.samples():
                fh.write(json.dumps(sample.to_dict()) + "\n")
                fh.flush()
                yield sample


class ReplaySource:
    def __init__(self, path: Path, speed: float = 1.0) -> None:
        self._path = path
        self._speed = speed
        with path.open(encoding="utf-8") as fh:
            first = json.loads(fh.readline() or "{}")
        if "session" not in first:
            raise SourceError(f"{path} n'est pas un enregistrement simrace")
        self._session = SessionInfo(**first["session"])

    def session(self) -> SessionInfo:
        return self._session

    def samples(self) -> Iterator[Sample]:
        previous: int | None = None
        with self._path.open(encoding="utf-8") as fh:
            next(fh)
            for line in fh:
                sample = Sample(**json.loads(line))
                if previous is not None:
                    time.sleep(max(sample.t_ms - previous, 0) / 1000 / self._speed)
                previous = sample.t_ms
                yield replace(sample, t_ms=int(time.time() * 1000))
