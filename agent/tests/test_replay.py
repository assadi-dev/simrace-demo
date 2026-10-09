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


def test_record_then_replay_roundtrip(tmp_path):
    path = tmp_path / "session.jsonl"
    recorded = list(Recorder(FakeSource(), path).samples())
    replay = ReplaySource(path, speed=1000)
    replayed = list(replay.samples())
    assert replay.session() == FakeSource().session()
    assert [s.packet_id for s in replayed] == [s.packet_id for s in recorded]
    assert [s.speed_kmh for s in replayed] == [s.speed_kmh for s in recorded]
