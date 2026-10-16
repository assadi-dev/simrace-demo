import pytest

from simrace_agent import cli, layout, layout_evo
from simrace_agent.models import Sample, SessionInfo
from simrace_agent.sources.acc import (
    AccSharedMemorySource,
    AcEvoSharedMemorySource,
    AutoSharedMemorySource,
    live_source,
)
from simrace_agent.sources.base import SourceError


def test_live_source_by_name():
    assert type(live_source("acc")) is AccSharedMemorySource
    assert type(live_source("acevo")) is AcEvoSharedMemorySource
    assert type(live_source("auto")) is AutoSharedMemorySource


def test_each_source_reads_its_own_pages():
    assert AccSharedMemorySource.layout is layout
    assert AcEvoSharedMemorySource.layout is layout_evo


def test_unknown_live_source_is_an_error():
    with pytest.raises(SourceError, match="auto, acc, acevo"):
        live_source("forza")


def test_unknown_source_in_env_stops_the_cli(monkeypatch):
    monkeypatch.setenv("SIMRACE_SOURCE", "forza")
    with pytest.raises(SystemExit, match="SIMRACE_SOURCE=forza"):
        cli.main(["probe"])


def test_cli_rejects_an_unknown_source_argument():
    with pytest.raises(SystemExit):
        cli.main(["record", "--out", "x.jsonl", "--source", "forza"])


def fake_sample(packet_id: int) -> Sample:
    return Sample(
        t_ms=packet_id, packet_id=packet_id, speed_kmh=100.0, gas=0.5, brake=0.0, gear=3,
        rpm=6000, steer=0.0, status=2, completed_laps=0, lap_time_ms=1000, last_lap_ms=0,
        best_lap_ms=0, sector=0, in_pit=False, track_pos=0.1,
    )


def fake_game(source_type, running: bool, game: str, packets=()):
    """Remplace la lecture de la memoire partagee d'un jeu (testable hors Windows)."""

    class Fake(source_type):
        def is_running(self) -> bool:
            return running

        def session(self) -> SessionInfo:
            return SessionInfo(track="Monza", car="voiture", driver="pilote", game=game)

        def read_until_lost(self):
            yield from (fake_sample(p) for p in packets)

    return Fake


def auto_with(evo, acc) -> AutoSharedMemorySource:
    source = AutoSharedMemorySource()
    source._candidates = [evo(stop=source._stop), acc(stop=source._stop)]
    return source


def test_auto_detects_evo_by_its_pages():
    source = auto_with(
        fake_game(AcEvoSharedMemorySource, True, "acevo", packets=(1, 2)),
        fake_game(AccSharedMemorySource, False, "acc"),
    )
    samples = source.samples()
    assert [next(samples).packet_id, next(samples).packet_id] == [1, 2]
    assert source.session().game == "acevo"


def test_auto_falls_back_to_acc():
    source = auto_with(
        fake_game(AcEvoSharedMemorySource, False, "acevo"),
        fake_game(AccSharedMemorySource, True, "acc", packets=(7,)),
    )
    assert next(source.samples()).packet_id == 7
    assert source.session().game == "acc"


def test_auto_without_any_game_has_no_session():
    source = auto_with(
        fake_game(AcEvoSharedMemorySource, False, "acevo"),
        fake_game(AccSharedMemorySource, False, "acc"),
    )
    assert source.detect() is None
    with pytest.raises(SourceError, match="aucun jeu detecte"):
        source.session()


def test_manual_source_names_its_own_game():
    # --source ou SIMRACE_SOURCE: le jeu de la session est celui de la source choisie
    assert AccSharedMemorySource.layout.GAME == "acc"
    assert AcEvoSharedMemorySource.layout.GAME == "acevo"
