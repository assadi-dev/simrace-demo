import pytest

from app.features.tracks.factory import (
    LapFactory,
    PieceFactory,
    ValidationStrategyFactory,
)
from app.features.tracks.repository import InMemoryLapRepository, InMemoryPieceRepository
from app.features.tracks.services import LapRecorderService, PieceRecorder
from app.features.tracks.strategy import DistanceThinningResampler, TrackPositionBinResampler
from app.shared.contract import SessionInfo
from app.shared.slug import Slug
from tests.features.tracks.helpers import accepted
from tests.support import FakeClock, lap_samples, sample


@pytest.fixture
def pieces() -> InMemoryPieceRepository:
    return InMemoryPieceRepository()


def make_recorder(pieces: InMemoryPieceRepository, laps=None) -> LapRecorderService:
    clock = FakeClock()
    piece_recorder = PieceRecorder(
        pieces,
        ValidationStrategyFactory.for_pieces(),
        PieceFactory(DistanceThinningResampler(5.0), clock),
    )
    return LapRecorderService(
        laps or InMemoryLapRepository(),
        ValidationStrategyFactory.default(),
        LapFactory(TrackPositionBinResampler(100), clock),
        piece_recorder,
    )


def saved(pieces: InMemoryPieceRepository):
    return sorted(pieces.list_summaries(Slug("monza")), key=lambda p: (p.lap_number, p.piece_index))


def test_each_sector_of_a_lap_is_saved_as_its_own_piece(pieces):
    recorder = make_recorder(pieces)
    recorder.on_samples_accepted(accepted(lap_samples(0) + lap_samples(1, last_lap_ms=9600)[:5]))
    assert [(p.piece_index, str(p.reason), p.sector) for p in saved(pieces)] == [
        (0, "sector", 0), (1, "sector", 1), (2, "lap_end", 2),
    ]
    assert recorder.piece_stats.by_trigger == {"sector": 2, "lap_end": 1}


def test_an_interrupted_lap_keeps_what_was_driven_when_the_game_is_paused(pieces):
    """Le besoin: un tour pas fini (pause) n'est pas perdu, contrairement au tour complet."""
    laps = InMemoryLapRepository()
    recorder = make_recorder(pieces, laps)
    half_lap = lap_samples(0)[:300]  # secteurs 0 et 1, pas la fin du tour
    pause = [sample(status=3, completed_laps=0, track_pos=0.5, t_ms=300 * 16 + 1)]
    recorder.on_samples_accepted(accepted(half_lap + pause))

    assert laps.list_tracks() == []  # aucun tour complet
    pieces_saved = saved(pieces)
    assert [str(p.reason) for p in pieces_saved] == ["sector", "pause"]
    assert pieces_saved[-1].end_pos == pytest.approx(299 / 600)
    assert recorder.stats.saved == 0


def test_entering_the_pits_saves_the_piece_driven_so_far(pieces):
    recorder = make_recorder(pieces)
    on_track = lap_samples(0)[:100]
    in_pit = lap_samples(0)[100:140]
    in_pit = [{**s, "in_pit": True} for s in in_pit]
    recorder.on_samples_accepted(accepted(on_track + in_pit))
    [piece] = saved(pieces)
    assert str(piece.reason) == "pit_entry"
    assert piece.end_pos == pytest.approx(99 / 600)


def test_piece_trace_is_thinned_to_a_point_every_few_meters(pieces):
    recorder = make_recorder(pieces)
    dense = lap_samples(0, count=3000)  # un echantillon par metre environ (cercle de 3 km)
    recorder.on_samples_accepted(accepted(dense[:1500] + [sample(status=3)]))
    first = saved(pieces)[0]  # le secteur 0: 1000 echantillons
    full = pieces.get(Slug("monza"), first.piece_id)
    assert 150 < len(full.points) < 300  # environ 1 point tous les 5 m, pas 1000
    assert first.point_count == len(full.points)


def test_same_piece_sent_twice_is_idempotent(pieces):
    first = make_recorder(pieces)
    first.on_samples_accepted(accepted(lap_samples(0)[:300] + [sample(status=3)]))
    count = len(saved(pieces))
    again = make_recorder(pieces)  # redemarrage du serveur: memes echantillons rejoues
    again.on_samples_accepted(accepted(lap_samples(0)[:300] + [sample(status=3)]))
    assert len(saved(pieces)) == count
    assert again.piece_stats.duplicates == count
    assert again.piece_stats.saved == 0


def test_a_very_short_piece_is_refused_with_its_reason(pieces):
    recorder = make_recorder(pieces)
    recorder.on_samples_accepted(accepted(lap_samples(0)[:10] + [sample(status=3)]))
    assert saved(pieces) == []
    assert recorder.piece_stats.rejected["too_few_points"] == 1


def test_a_piece_without_coordinates_is_refused(pieces):
    recorder = make_recorder(pieces)
    no_xz = lap_samples(0, with_xz=False)[:100] + [sample(status=3)]
    recorder.on_samples_accepted(accepted(no_xz))
    assert recorder.piece_stats.rejected["no_coordinates"] == 1


def test_a_piece_with_lost_batches_is_refused(pieces):
    recorder = make_recorder(pieces)
    holey = lap_samples(0, drop=range(40, 140))[:150] + [sample(status=3)]
    recorder.on_samples_accepted(accepted(holey))
    assert recorder.piece_stats.rejected["data_gap"] == 1


def test_track_name_from_the_agent_is_sanitized_before_becoming_a_path(pieces):
    recorder = make_recorder(pieces)
    session = SessionInfo(track="../../Nürburgring GP", car="c", driver="d")
    recorder.on_samples_accepted(accepted(lap_samples(0)[:100] + [sample(status=3)], session=session))
    assert [str(t) for t in pieces.list_tracks()] == ["nurburgring_gp"]


def test_storage_failure_is_counted_not_raised():
    class FailingPieces(InMemoryPieceRepository):
        def save(self, piece):
            raise OSError("disque plein")

    recorder = make_recorder(FailingPieces())
    recorder.on_samples_accepted(accepted(lap_samples(0)[:100] + [sample(status=3)]))
    assert recorder.piece_stats.rejected["storage_error"] == 1


def test_pieces_can_be_switched_off_without_touching_laps():
    laps = InMemoryLapRepository()
    clock = FakeClock()
    recorder = LapRecorderService(
        laps,
        ValidationStrategyFactory.default(),
        LapFactory(TrackPositionBinResampler(100), clock),
    )
    recorder.on_samples_accepted(accepted(lap_samples(0) + lap_samples(1, last_lap_ms=9600)))
    assert recorder.stats.saved == 1
    assert recorder.pieces_enabled is False
    assert recorder.piece_stats.saved == 0
