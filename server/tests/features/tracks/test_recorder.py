import pytest

from app.features.tracks.factory import LapFactory, ValidationStrategyFactory
from app.features.tracks.repository import InMemoryLapRepository, LapRepository
from app.features.tracks.services import LapRecorderService
from app.features.tracks.strategy import TrackPositionBinResampler
from app.shared.contract import SessionInfo
from app.shared.slug import Slug
from tests.features.tracks.helpers import accepted
from tests.support import FakeClock, lap_samples


@pytest.fixture
def repository() -> InMemoryLapRepository:
    return InMemoryLapRepository()


def make_recorder(repository: LapRepository) -> LapRecorderService:
    return LapRecorderService(
        repository,
        ValidationStrategyFactory.default(),
        LapFactory(TrackPositionBinResampler(100), FakeClock()),
    )


def two_laps() -> list[dict]:
    """Tours 0 et 1 complets, puis le debut du tour 2 qui cloture le tour 1."""
    return lap_samples(0) + lap_samples(1, last_lap_ms=9600) + lap_samples(2, count=5, last_lap_ms=9000)


def test_valid_laps_are_saved_one_per_lap(repository):
    recorder = make_recorder(repository)
    recorder.on_samples_accepted(accepted(two_laps()))
    assert recorder.stats.saved == 2
    saved = repository.list_summaries(Slug("monza"))
    assert sorted(s.lap_number for s in saved) == [0, 1]
    assert sorted(s.lap_time_ms for s in saved) == [9000, 9600]


def test_saved_trace_is_resampled_and_has_a_plausible_length(repository):
    recorder = make_recorder(repository)
    recorder.on_samples_accepted(accepted(two_laps()))
    lap = repository.get(Slug("monza"), Slug("sim-1-run-1-lap000"))
    assert len(lap.points) == 100
    # boucle de rayon 500 m: perimetre 3141 m (a quelques % pres apres reechantillonnage)
    assert lap.summary.length_m == pytest.approx(3141, rel=0.03)


def test_batches_can_split_a_lap_anywhere(repository):
    recorder = make_recorder(repository)
    samples = two_laps()
    for start in range(0, len(samples), 37):
        recorder.on_samples_accepted(accepted(samples[start : start + 37]))
    assert recorder.stats.saved == 2


def test_agent_without_coordinates_records_nothing_but_says_why(repository):
    recorder = make_recorder(repository)
    no_xz = lap_samples(0, with_xz=False) + lap_samples(1, last_lap_ms=9600, with_xz=False)
    recorder.on_samples_accepted(accepted(no_xz))
    assert recorder.stats.saved == 0
    assert recorder.stats.rejected["no_coordinates"] == 1


def test_lap_through_the_pits_is_refused(repository):
    recorder = make_recorder(repository)
    recorder.on_samples_accepted(
        accepted(lap_samples(0, in_pit=True) + lap_samples(1, last_lap_ms=9600))
    )
    assert recorder.stats.rejected["pit_involved"] == 1
    assert recorder.stats.saved == 0


def test_lap_with_lost_batches_is_refused(repository):
    recorder = make_recorder(repository)
    holey = lap_samples(0, drop=range(200, 300))  # 100 echantillons perdus = 1,6 s
    recorder.on_samples_accepted(accepted(holey + lap_samples(1, last_lap_ms=9600)))
    assert recorder.stats.rejected["data_gap"] == 1


def test_first_lap_started_mid_track_is_refused(repository):
    recorder = make_recorder(repository)
    mid = lap_samples(0)[300:]  # le poste s'est connecte en plein tour
    recorder.on_samples_accepted(accepted(mid + lap_samples(1, last_lap_ms=9600)))
    assert recorder.stats.rejected["started_mid_lap"] == 1


def test_same_lap_sent_twice_is_idempotent_not_duplicated(repository):
    recorder = make_recorder(repository)
    recorder.on_samples_accepted(accepted(two_laps()))
    again = make_recorder(repository)  # redemarrage du serveur: memes tours rejoues
    again.on_samples_accepted(accepted(two_laps()))
    assert again.stats.duplicates == 2
    assert again.stats.saved == 0
    assert len(repository.list_summaries(Slug("monza"))) == 2


def test_a_new_run_id_starts_a_fresh_lap(repository):
    recorder = make_recorder(repository)
    recorder.on_samples_accepted(accepted(lap_samples(0)[:300]))  # run-1 coupe en plein tour
    recorder.on_samples_accepted(accepted(two_laps(), run_id="run-2"))
    assert recorder.stats.saved == 2  # le tour tronque de run-1 n'a pas pollue run-2
    assert {s.station_id for s in repository.list_summaries(Slug("monza"))} == {"sim-1"}


def test_stations_are_tracked_independently(repository):
    recorder = make_recorder(repository)
    for station in ("sim-1", "sim-2"):
        recorder.on_samples_accepted(accepted(two_laps(), station_id=station))
    assert recorder.stats.saved == 4


def test_track_name_from_the_agent_is_sanitized_before_becoming_a_path(repository):
    recorder = make_recorder(repository)
    session = SessionInfo(track="../../Nürburgring GP", car="c", driver="d")
    recorder.on_samples_accepted(accepted(two_laps(), session=session))
    assert [str(t) for t in repository.list_tracks()] == ["nurburgring_gp"]


def test_unusable_track_name_is_counted_not_crashing(repository):
    recorder = make_recorder(repository)
    session = SessionInfo(track="///", car="c", driver="d")
    recorder.on_samples_accepted(accepted(two_laps(), session=session))
    assert recorder.stats.saved == 0
    assert recorder.stats.rejected["invalid_lap_data"] == 2


def test_storage_failure_is_counted_not_raised():
    class FailingRepository(InMemoryLapRepository):
        def save(self, lap):
            raise OSError("disque plein")

    recorder = make_recorder(FailingRepository())
    recorder.on_samples_accepted(accepted(two_laps()))
    assert recorder.stats.rejected["storage_error"] == 2
