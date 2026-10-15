import json
import threading
from datetime import UTC, datetime
from pathlib import Path

from test_replay import FakeSource, make_sample

from simrace_agent import actions, theme
from simrace_agent.models import SessionInfo
from simrace_agent.sources.replay import Recorder


class EndlessSource(FakeSource):
    """Comme ACC: ne s'arrete jamais d'elle-meme. Pose le stop apres `stop_after` echantillons."""

    def __init__(self, stop: threading.Event, stop_after: int) -> None:
        self._stop = stop
        self._stop_after = stop_after

    def samples(self):
        i = 0
        while True:
            if i == self._stop_after:
                self._stop.set()
            yield make_sample(i)
            i += 1


class FakeSender:
    dropped = refused = 0

    def __init__(self) -> None:
        self.batches: list[list[dict]] = []
        self.closed = False

    def start(self) -> None:
        pass

    def submit(self, session: SessionInfo, samples: list[dict]) -> None:
        if samples:
            self.batches.append(samples)

    def close(self) -> None:
        self.closed = True


def test_stream_stops_on_event_and_sends_last_batch():
    stop = threading.Event()
    sender = FakeSender()
    actions.stream(EndlessSource(stop, stop_after=3), sender, batch_ms=60_000, stop=stop)
    assert [s["packet_id"] for batch in sender.batches for s in batch] == [0, 1, 2]
    assert sender.closed


def test_record_stops_on_event_and_keeps_file(tmp_path):
    stop = threading.Event()
    path = tmp_path / "sub" / "session.jsonl"
    count = actions.record(EndlessSource(stop, stop_after=4), path, stop)
    lines = path.read_text(encoding="utf-8").splitlines()
    assert "session" in json.loads(lines[0])
    assert count == 5  # l'echantillon en cours au moment du stop est ecrit
    assert len(lines) == 1 + count


def test_recording_path_is_timestamped():
    path = actions.recording_path(Path("rec"), datetime(2026, 10, 15, 9, 5, 7, tzinfo=UTC))
    assert path == Path("rec") / "session-20261015-090507.jsonl"


def test_theme_scale_and_font_fallback():
    assert theme.px(44) == 33  # bouton h-11 a l'echelle 0,75 du front
    assert theme.pick_family({"Segoe UI", "Arial"}, theme.FONT_FAMILIES) == "Segoe UI"
    assert theme.pick_family({"Inter", "Segoe UI"}, theme.FONT_FAMILIES) == "Inter"


def test_list_replays_newest_first_and_skips_foreign_files(tmp_path):
    import os

    old, new = tmp_path / "old.jsonl", tmp_path / "new.jsonl"
    for path, track in ((old, "spa"), (new, "monza")):
        list(Recorder(Named(track), path).samples())
    os.utime(old, (1_000_000, 1_000_000))
    (tmp_path / "notes.jsonl").write_text('{"autre": 1}\n', encoding="utf-8")
    (tmp_path / "vide.jsonl").write_text("", encoding="utf-8")
    (tmp_path / "abime.jsonl").write_text("{pas du json\n", encoding="utf-8")

    replays = actions.list_replays(tmp_path)
    assert [path for path, _ in replays] == [new, old]
    assert "monza" in replays[0][1] and "new.jsonl" in replays[0][1]


def test_list_replays_of_missing_folder_is_empty(tmp_path):
    assert actions.list_replays(tmp_path / "absent") == []


class Named(FakeSource):
    def __init__(self, track: str) -> None:
        self._track = track

    def session(self) -> SessionInfo:
        return SessionInfo(track=self._track, car="gt3", driver="A B")


def test_browsed_file_outside_folder_joins_the_list(tmp_path):
    folder, elsewhere = tmp_path / "rec", tmp_path / "ailleurs"
    folder.mkdir()
    elsewhere.mkdir()
    inside, outside = folder / "a.jsonl", elsewhere / "b.json"
    list(Recorder(Named("spa"), inside).samples())
    list(Recorder(Named("monza"), outside).samples())

    assert {path for path, _ in actions.list_replays(folder, outside)} == {inside, outside}
    assert len(actions.list_replays(folder, inside)) == 1  # pas de doublon


def test_only_json_files_are_accepted(tmp_path):
    good, other = tmp_path / "s.jsonl", tmp_path / "s.txt"
    list(Recorder(Named("spa"), good).samples())
    other.write_bytes(good.read_bytes())  # meme contenu, mauvaise extension
    assert actions.replay_info(good) is not None
    assert actions.replay_info(other) is None
    assert [path for path, _ in actions.list_replays(tmp_path)] == [good]
