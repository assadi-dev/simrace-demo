from collections import Counter

from app.features.ingestion.events import SamplesAccepted
from app.features.tracks.assembler import AssemblyResult, LapAssembler
from app.features.tracks.domain import (
    Lap,
    LapCandidate,
    LapSummary,
    Piece,
    PieceCandidate,
    PieceSummary,
    TrackSummary,
)
from app.features.tracks.factory import LapFactory, PieceFactory
from app.features.tracks.pieces import PieceCutter
from app.features.tracks.repository import (
    LapAlreadyExistsError,
    LapRepository,
    PieceAlreadyExistsError,
    PieceRepository,
)
from app.features.tracks.strategy import (
    LapValidationStrategy,
    ReferenceSelectionStrategy,
    ResamplingError,
)
from app.shared.contract import Sample, SessionInfo
from app.shared.errors import InvalidSlugError, NotFoundError
from app.shared.slug import Slug


class TrackNotFoundError(NotFoundError):
    pass


class LapNotFoundError(NotFoundError):
    pass


class PieceNotFoundError(NotFoundError):
    pass


class RecorderStats:
    """Ce que l'enregistreur a fait. Un refus n'est jamais silencieux: il est compte avec sa raison."""

    def __init__(self) -> None:
        self.saved = 0
        self.duplicates = 0
        self.rejected: Counter[str] = Counter()  # tour termine mais refuse (raison)
        self.discarded: Counter[str] = Counter()  # tour abandonne en cours de route (raison)


class PieceStats:
    def __init__(self) -> None:
        self.saved = 0
        self.duplicates = 0
        self.rejected: Counter[str] = Counter()  # morceau ferme mais refuse (raison)
        self.by_trigger: Counter[str] = Counter()  # morceaux enregistres, par declencheur


class PieceRecorder:
    """Enregistre les morceaux de trace des que le joueur franchit un secteur, met en pause,
    entre aux stands ou finit un tour: la trace d'un tour interrompu n'est pas perdue."""

    def __init__(
        self,
        repository: PieceRepository,
        validation: LapValidationStrategy,
        factory: PieceFactory,
    ) -> None:
        self._repository = repository
        self._validation = validation
        self._factory = factory
        self._cutters: dict[str, PieceCutter] = {}
        self.stats = PieceStats()

    def push(
        self, station_id: str, run_id: str, sample: Sample, session: SessionInfo, lap_closed: bool
    ) -> None:
        cutter = self._cutters.get(station_id)
        # un nouveau run_id = l'agent a redemarre: on repart de zero
        if cutter is None or cutter.run_id != run_id:
            cutter = PieceCutter(station_id, run_id)
            self._cutters[station_id] = cutter
        for candidate in cutter.push(sample, session, lap_closed):
            self._record(candidate)

    def _record(self, candidate: PieceCandidate) -> None:
        reason = self._validation.first_failure(candidate)
        if reason:
            self.stats.rejected[reason] += 1
            return
        try:
            track = Slug.from_untrusted(candidate.track)
            piece = self._factory.create(candidate, track)
            self._repository.save(piece)
        except PieceAlreadyExistsError:
            self.stats.duplicates += 1  # meme morceau renvoye: idempotent
        except (InvalidSlugError, ResamplingError):
            self.stats.rejected["invalid_piece_data"] += 1
        except OSError:
            self.stats.rejected["storage_error"] += 1
        else:
            self.stats.saved += 1
            self.stats.by_trigger[str(candidate.reason)] += 1


class LapRecorderService:
    """Abonne aux echantillons acceptes: detecte les tours, les valide, les enregistre.

    Les morceaux de tour (pause, stands, secteur) sont confies a un PieceRecorder facultatif.
    """

    def __init__(
        self,
        repository: LapRepository,
        validation: LapValidationStrategy,
        factory: LapFactory,
        pieces: PieceRecorder | None = None,
    ) -> None:
        self._repository = repository
        self._validation = validation
        self._factory = factory
        self._pieces = pieces
        self._assemblers: dict[str, LapAssembler] = {}
        self.stats = RecorderStats()

    @property
    def piece_stats(self) -> PieceStats:
        return self._pieces.stats if self._pieces else PieceStats()

    @property
    def pieces_enabled(self) -> bool:
        return self._pieces is not None

    def on_samples_accepted(self, event: SamplesAccepted) -> None:
        assembler = self._assembler_for(event.station_id, event.run_id)
        for sample in event.samples:
            result = assembler.push(sample, event.session)
            if result is not None:
                self._handle(result)
            if self._pieces is not None:
                lap_closed = result is not None and result.candidate is not None
                self._pieces.push(event.station_id, event.run_id, sample, event.session, lap_closed)

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

    def __init__(
        self,
        repository: LapRepository,
        reference: ReferenceSelectionStrategy,
        pieces: PieceRepository,
    ) -> None:
        self._repository = repository
        self._reference = reference
        self._pieces = pieces

    @property
    def reference_strategy_name(self) -> str:
        return self._reference.name

    def list_tracks(self) -> list[TrackSummary]:
        names = {*self._repository.list_tracks(), *self._pieces.list_tracks()}
        summaries = []
        for track in sorted(names, key=str):
            laps = self._repository.list_summaries(track)
            pieces = self._pieces.list_summaries(track)
            if laps or pieces:
                best = min((lap.lap_time_ms for lap in laps), default=None)
                summaries.append(TrackSummary(track, len(laps), best, len(pieces)))
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

    def list_pieces(self, track: Slug) -> list[PieceSummary]:
        pieces = self._pieces.list_summaries(track)
        if not pieces:
            raise TrackNotFoundError(f"aucun morceau enregistre pour le circuit {track}")
        return sorted(
            pieces, key=lambda p: (p.recorded_at, p.lap_number, p.piece_index, str(p.piece_id))
        )

    def get_piece(self, track: Slug, piece_id: Slug) -> Piece:
        piece = self._pieces.get(track, piece_id)
        if piece is None:
            raise PieceNotFoundError(f"morceau inconnu: {track}/{piece_id}")
        return piece
