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
