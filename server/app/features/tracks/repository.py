import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ValidationError

from app.features.tracks.domain import Lap, LapSummary
from app.shared.errors import ConflictError, InvalidSlugError
from app.shared.slug import Slug

logger = logging.getLogger(__name__)


class LapAlreadyExistsError(ConflictError):
    pass


class CorruptLapError(Exception):
    """Un fichier de tour est illisible. Erreur serveur (500), pas une erreur du client."""


class LapRepository(ABC):
    """Stockage des tours enregistres. Un tour n'est jamais ecrase."""

    @abstractmethod
    def save(self, lap: Lap) -> None:
        """Enregistre un tour. Leve LapAlreadyExistsError s'il existe deja."""

    @abstractmethod
    def get(self, track: Slug, lap_id: Slug) -> Lap | None: ...

    @abstractmethod
    def list_summaries(self, track: Slug) -> list[LapSummary]: ...

    @abstractmethod
    def list_tracks(self) -> list[Slug]: ...


class InMemoryLapRepository(LapRepository):
    def __init__(self) -> None:
        self._laps: dict[tuple[Slug, Slug], Lap] = {}

    def save(self, lap: Lap) -> None:
        key = (lap.summary.track, lap.summary.lap_id)
        if key in self._laps:
            raise LapAlreadyExistsError(f"tour deja enregistre: {lap.summary.lap_id}")
        self._laps[key] = lap

    def get(self, track: Slug, lap_id: Slug) -> Lap | None:
        return self._laps.get((track, lap_id))

    def list_summaries(self, track: Slug) -> list[LapSummary]:
        return [lap.summary for (t, _), lap in self._laps.items() if t == track]

    def list_tracks(self) -> list[Slug]:
        return sorted({t for t, _ in self._laps}, key=str)


class LapDocument(BaseModel):
    """Format du fichier d'un tour (version 1). Le point i de N est a la position i / N."""

    version: Literal[1] = 1
    lap_id: str
    track: str
    station_id: str
    run_id: str
    car: str
    lap_number: int
    lap_time_ms: int
    recorded_at: datetime
    length_m: float
    points: list[tuple[float, float]]

    @classmethod
    def from_lap(cls, lap: Lap) -> "LapDocument":
        s = lap.summary
        return cls(
            lap_id=str(s.lap_id), track=str(s.track), station_id=s.station_id, run_id=lap.run_id,
            car=s.car, lap_number=s.lap_number, lap_time_ms=s.lap_time_ms,
            recorded_at=s.recorded_at, length_m=s.length_m, points=list(lap.points),
        )

    def to_lap(self) -> Lap:
        summary = LapSummary(
            lap_id=Slug(self.lap_id), track=Slug(self.track), station_id=self.station_id,
            car=self.car, lap_number=self.lap_number, lap_time_ms=self.lap_time_ms,
            recorded_at=self.recorded_at, length_m=self.length_m,
        )
        return Lap(summary=summary, run_id=self.run_id, points=tuple(self.points))


class JsonLapRepository(LapRepository):
    """Un fichier JSON par tour: <racine>/tracks/<circuit>/<tour>.json.

    L'ecriture passe par un fichier temporaire puis `os.link` vers le nom final: elle echoue si le
    fichier existe (pas d'ecrasement) et aucun lecteur ne voit un fichier a moitie ecrit.
    """

    def __init__(self, root: Path) -> None:
        self._root = Path(root).resolve() / "tracks"

    def save(self, lap: Lap) -> None:
        final = self._lap_path(lap.summary.track, lap.summary.lap_id)
        final.parent.mkdir(parents=True, exist_ok=True)
        payload = LapDocument.from_lap(lap).model_dump_json()
        temp = final.parent / f".{final.name}.{uuid4().hex}.tmp"
        temp.write_text(payload, encoding="utf-8")
        try:
            try:
                os.link(temp, final)
            except FileExistsError:
                raise LapAlreadyExistsError(f"tour deja enregistre: {lap.summary.lap_id}") from None
            except OSError:
                # systeme de fichiers sans lien physique: creation exclusive directe
                self._write_exclusive(final, payload, lap)
        finally:
            temp.unlink(missing_ok=True)

    def get(self, track: Slug, lap_id: Slug) -> Lap | None:
        path = self._lap_path(track, lap_id)
        if not path.is_file():
            return None
        return self._read(path)

    def list_summaries(self, track: Slug) -> list[LapSummary]:
        summaries: list[LapSummary] = []
        for path in sorted(self._track_dir(track).glob("*.json")):
            try:
                summaries.append(self._read(path).summary)
            except CorruptLapError:
                logger.warning("fichier de tour ignore (illisible): %s", path)
        return summaries

    def list_tracks(self) -> list[Slug]:
        if not self._root.is_dir():
            return []
        tracks = []
        for entry in sorted(self._root.iterdir()):
            if entry.is_dir() and any(entry.glob("*.json")):
                try:
                    tracks.append(Slug(entry.name))
                except InvalidSlugError:
                    continue
        return tracks

    @staticmethod
    def _write_exclusive(final: Path, payload: str, lap: Lap) -> None:
        try:
            with open(final, "x", encoding="utf-8") as handle:
                handle.write(payload)
        except FileExistsError:
            raise LapAlreadyExistsError(f"tour deja enregistre: {lap.summary.lap_id}") from None

    def _track_dir(self, track: Slug) -> Path:
        return self._checked(self._root / str(track))

    def _lap_path(self, track: Slug, lap_id: Slug) -> Path:
        return self._checked(self._root / str(track) / f"{lap_id}.json")

    def _checked(self, path: Path) -> Path:
        """Ceinture et bretelles: les Slug suffisent, on verifie quand meme le chemin final."""
        resolved = path.resolve()
        if not resolved.is_relative_to(self._root):
            raise ConflictError("chemin hors du dossier de donnees")
        return resolved

    @staticmethod
    def _read(path: Path) -> Lap:
        try:
            return LapDocument.model_validate_json(path.read_text(encoding="utf-8")).to_lap()
        except (OSError, ValidationError, ValueError, InvalidSlugError) as exc:
            raise CorruptLapError(f"fichier de tour illisible: {path.name}") from exc
