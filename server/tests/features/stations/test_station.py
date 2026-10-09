from datetime import timedelta

from app.features.stations.domain import BatchDisposition, Station
from app.features.stations.strategy import SilenceWindowPolicy
from app.shared.contract import SessionInfo
from tests.support import FakeClock

SESSION = SessionInfo(track="monza", car="c", driver="d")


def make_station() -> Station:
    return Station("sim-1", "run-1", SESSION)


def test_first_batch_is_accepted_without_gap():
    station = make_station()
    assert station.register_batch(1) is BatchDisposition.ACCEPTED
    assert (station.last_seq, station.batches, station.gaps) == (1, 1, 0)


def test_replayed_seq_is_a_duplicate_and_not_counted_as_a_batch():
    station = make_station()
    station.register_batch(1)
    assert station.register_batch(1) is BatchDisposition.DUPLICATE
    assert (station.batches, station.duplicates) == (1, 1)


def test_older_seq_is_also_a_duplicate():
    station = make_station()
    station.register_batch(1)
    station.register_batch(2)
    assert station.register_batch(1) is BatchDisposition.DUPLICATE


def test_skipped_seq_counts_missing_batches():
    station = make_station()
    station.register_batch(1)
    station.register_batch(4)
    assert station.gaps == 2


def test_record_samples_accumulates_reasons():
    station = make_station()
    station.record_samples(10, 2, {"speed_kmh:less_than_equal": 2})
    station.record_samples(5, 1, {"speed_kmh:less_than_equal": 1, "gas:less_than_equal": 0})
    assert (station.samples, station.rejected) == (15, 3)
    assert station.reject_reasons["speed_kmh:less_than_equal"] == 3


def test_touch_keeps_known_machine_name_when_omitted():
    clock = FakeClock()
    station = make_station()
    station.touch(clock.now(), "PC-01")
    station.touch(clock.now(), None)
    assert station.machine == "PC-01"
    assert station.last_seen == clock.now()


def test_reject_reasons_is_a_copy():
    station = make_station()
    station.record_samples(0, 1, {"x:y": 1})
    station.reject_reasons["x:y"] = 99
    assert station.reject_reasons["x:y"] == 1


def test_silence_window_policy():
    clock = FakeClock()
    policy = SilenceWindowPolicy(timedelta(seconds=5))
    assert policy.is_online(None, clock.now()) is False
    seen = clock.now()
    clock.advance(5)
    assert policy.is_online(seen, clock.now()) is True
    clock.advance(0.1)
    assert policy.is_online(seen, clock.now()) is False
