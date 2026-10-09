from app.features.tracks.schemas import (
    LapOut,
    LapSummaryOut,
    RecorderStatusOut,
    TrackMapOut,
    TrackSummaryOut,
)
from app.features.tracks.services import LapRecorderService, TrackQueryService
from app.shared.slug import Slug


class TrackController:
    """Lecture seule, fonctions simples (`def`): elles lisent des fichiers, FastAPI les execute
    dans un thread et la boucle d'evenements n'est pas bloquee."""

    def __init__(self, queries: TrackQueryService) -> None:
        self._queries = queries

    def list_tracks(self) -> list[TrackSummaryOut]:
        return [TrackSummaryOut.from_summary(s) for s in self._queries.list_tracks()]

    def list_laps(self, track: str) -> list[LapSummaryOut]:
        return [LapSummaryOut.from_summary(s) for s in self._queries.list_laps(Slug(track))]

    def get_lap(self, track: str, lap_id: str) -> LapOut:
        return LapOut.from_lap(self._queries.get_lap(Slug(track), Slug(lap_id)))

    def get_reference(self, track: str) -> TrackMapOut:
        lap = self._queries.get_reference(Slug(track))
        return TrackMapOut.from_reference(lap, self._queries.reference_strategy_name)


class RecorderController:
    """`async`: lit les compteurs que l'enregistreur modifie sur la boucle d'evenements."""

    def __init__(self, recorder: LapRecorderService, enabled: bool) -> None:
        self._recorder = recorder
        self._enabled = enabled

    async def status(self) -> RecorderStatusOut:
        return RecorderStatusOut.from_stats(self._recorder.stats, self._enabled)
