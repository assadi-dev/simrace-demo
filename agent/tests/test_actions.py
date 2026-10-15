import json
import threading
from datetime import UTC, datetime
from pathlib import Path

from test_replay import FakeSource, make_sample

from simrace_agent import actions, theme
from simrace_agent.models import SessionInfo


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
