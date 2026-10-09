from collections import Counter

from app.features.ingestion.events import SamplesAccepted
from app.features.tracks.assembler import AssemblyResult, LapAssembler
from app.features.tracks.domain import Lap, LapCandidate, LapSummary, TrackSummary
from app.features.tracks.factory import LapFactory
from app.features.tracks.repository import LapAlreadyExistsError, LapRepository
from app.features.tracks.strategy import (
    LapValidationStrategy,
    ReferenceSelectionStrategy,
    ResamplingError,
)
from app.shared.errors import InvalidSlugError, NotFoundError
from app.shared.slug import Slug


class TrackNotFoundError(NotFoundError):
    pass


class LapNotFoundError(NotFoundError):
    pass


class RecorderStats:
    """Ce que l'enregistreur a fait. Un refus n'est jamais silencieux: il est compte avec sa raison."""

    def __init__(self) -> None:
        self.saved = 0
        self.duplicates = 0
        self.rejected: Counter[str] = Counter()  # tour termine mais refuse (raison)
        self.discarded: Counter[str] = Counter()  # tour abandonne en cours de route (raison)


class LapRecorderService:
    """Abonne aux echantillons acceptes: detecte les tours, les valide, les enregistre."""

    def __init__(
        self,
        repository: LapRepository,
        validation: LapValidationStrategy,
        factory: LapFactory,
    ) -> None:
        self._repository = repository
        self._validation = validation
        self._factory = factory
        self._assemblers: dict[str, LapAssembler] = {}
        self.stats = RecorderStats()

    def on_samples_accepted(self, event: SamplesAccepted) -> None:
        assembler = self._assembler_for(event.station_id, event.run_id)
        for sample in event.samples:
            result = assembler.push(sample, event.session)
            if result is not None:
                self._handle(result)

    def _assembler_for(self, station_id: str, run_id: str) -> LapAssembler:
        assembler = self._assemblers.get(station_id)
        # un nouveau run_id = l'agent a redemarre: on repart de zero
        if assembler is None or assembler.run_id != run_id:
            assembler = LapAssembler(station_id, run_id)
            self._assemblers[station_id] = assembler
        return assembler

    def _handle(self, result: AssemblyResult) -> None:
        if result.discarded_reason:
            self.stats.discarded[result.discarded_reason] += 1
        if result.candidate is not None:
            self._record(result.candidate)

    def _record(self, candidate: LapCandidate) -> None:
        reason = self._validation.first_failure(candidate)
        if reason:
            self.stats.rejected[reason] += 1
            return
        try:
            track = Slug.from_untrusted(candidate.track)
            lap = self._factory.create(candidate, track)
            self._repository.save(lap)
        except LapAlreadyExistsError:
            self.stats.duplicates += 1  # meme tour renvoye: idempotent
        except (InvalidSlugError, ResamplingError):
            self.stats.rejected["invalid_lap_data"] += 1
        except OSError:
            self.stats.rejected["storage_error"] += 1
        else:
            self.stats.saved += 1


class TrackQueryService:
    """Lecture des tracés enregistres, pour le front."""

    def __init__(self, repository: LapRepository, reference: ReferenceSelectionStrategy) -> None:
        self._repository = repository
        self._reference = reference

    @property
    def reference_strategy_name(self) -> str:
        return self._reference.name

    def list_tracks(self) -> list[TrackSummary]:
        summaries = []
        for track in self._repository.list_tracks():
            laps = self._repository.list_summaries(track)
            if laps:
                best = min(lap.lap_time_ms for lap in laps)
                summaries.append(TrackSummary(track, len(laps), best))
        return summaries

    def list_laps(self, track: Slug) -> list[LapSummary]:
        laps = self._repository.list_summaries(track)
        if not laps:
            raise TrackNotFoundError(f"aucun tour enregistre pour le circuit {track}")
        return sorted(laps, key=lambda lap: (lap.recorded_at, str(lap.lap_id)), reverse=True)

    def get_lap(self, track: Slug, lap_id: Slug) -> Lap:
        lap = self._repository.get(track, lap_id)
        if lap is None:
            raise LapNotFoundError(f"tour inconnu: {track}/{lap_id}")
        return lap

    def get_reference(self, track: Slug) -> Lap:
        chosen = self._reference.select(self.list_laps(track))
        if chosen is None:
            raise TrackNotFoundError(f"aucun tour enregistre pour le circuit {track}")
        return self.get_lap(track, chosen.lap_id)
