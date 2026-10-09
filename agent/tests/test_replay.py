import json
from dataclasses import replace

from simrace_agent.models import Sample, SessionInfo
from simrace_agent.sources.replay import Recorder, ReplaySource


def make_sample(i: int) -> Sample:
    return Sample(
        t_ms=1000 + i * 10, packet_id=i, speed_kmh=100.0 + i, gas=0.5, brake=0.0, gear=3,
        rpm=6000, steer=0.0, status=2, completed_laps=0, lap_time_ms=i * 10, last_lap_ms=0,
        best_lap_ms=0, sector=0, in_pit=False, track_pos=i / 100,
    )


class FakeSource:
    def session(self) -> SessionInfo:
        return SessionInfo(track="monza", car="gt3", driver="A B")

    def samples(self):
        yield from (make_sample(i) for i in range(5))


def test_position_survives_record_and_replay(tmp_path):
    class WithPosition(FakeSource):
        def samples(self):
            yield replace(make_sample(0), x=12.5, z=-80.25)

    path = tmp_path / "session.jsonl"
    list(Recorder(WithPosition(), path).samples())
    [replayed] = list(ReplaySource(path, speed=1000).samples())
    assert (replayed.x, replayed.z) == (12.5, -80.25)


def test_old_recording_without_position_still_replays(tmp_path):
    path = tmp_path / "old.jsonl"
    sample = make_sample(1).to_dict()
    del sample["x"], sample["z"]  # enregistrement fait avant l'ajout de la position
    path.write_text(
        json.dumps({"session": FakeSource().session().to_dict()}) + "\n" + json.dumps(sample) + "\n",
        encoding="utf-8",
    )
    [replayed] = list(ReplaySource(path, speed=1000).samples())
    assert (replayed.x, replayed.z) == (None, None)


def test_record_then_replay_roundtrip(tmp_path):
    path = tmp_path / "session.jsonl"
    recorded = list(Recorder(FakeSource(), path).samples())
    replay = ReplaySource(path, speed=1000)
    replayed = list(replay.samples())
    assert replay.session() == FakeSource().session()
    assert [s.packet_id for s in replayed] == [s.packet_id for s in recorded]
    assert [s.speed_kmh for s in replayed] == [s.speed_kmh for s in recorded]


def test_tyres_and_brakes_survive_record_and_replay(tmp_path):
    class WithTyres(FakeSource):
        def samples(self):
            yield replace(make_sample(0), tyre_pressure_psi=[26.1, 26.6, 26.7, 26.6],
                          brake_temp_c=[300.0, 310.0, 250.0, 255.0])

    path = tmp_path / "session.jsonl"
    list(Recorder(WithTyres(), path).samples())
    [replayed] = list(ReplaySource(path, speed=1000).samples())
    assert replayed.tyre_pressure_psi == [26.1, 26.6, 26.7, 26.6]
    assert replayed.brake_temp_c == [300.0, 310.0, 250.0, 255.0]
    assert replayed.tyre_temp_c is None


def test_fuel_and_aids_survive_record_and_replay(tmp_path):
    class WithFuel(FakeSource):
        def samples(self):
            yield replace(make_sample(0), fuel_l=62.0, fuel_per_lap_l=3.0, tc_level=7, abs_level=4)

    path = tmp_path / "session.jsonl"
    list(Recorder(WithFuel(), path).samples())
    [replayed] = list(ReplaySource(path, speed=1000).samples())
    assert (replayed.fuel_l, replayed.fuel_per_lap_l) == (62.0, 3.0)
    assert (replayed.tc_level, replayed.abs_level) == (7, 4)


def test_g_forces_survive_record_and_replay(tmp_path):
    class WithG(FakeSource):
        def samples(self):
            yield replace(make_sample(0), g_lat=0.5, g_vert=1.0, g_long=-1.4)

    path = tmp_path / "session.jsonl"
    list(Recorder(WithG(), path).samples())
    [replayed] = list(ReplaySource(path, speed=1000).samples())
    assert (replayed.g_lat, replayed.g_vert, replayed.g_long) == (0.5, 1.0, -1.4)
