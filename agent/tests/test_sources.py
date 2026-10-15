import pytest

from simrace_agent import cli, layout, layout_evo
from simrace_agent.sources.acc import (
    AccSharedMemorySource,
    AcEvoSharedMemorySource,
    live_source,
)
from simrace_agent.sources.base import SourceError


def test_live_source_by_name():
    assert type(live_source("acc")) is AccSharedMemorySource
    assert type(live_source("acevo")) is AcEvoSharedMemorySource


def test_each_source_reads_its_own_pages():
    assert AccSharedMemorySource.layout is layout
    assert AcEvoSharedMemorySource.layout is layout_evo


def test_unknown_live_source_is_an_error():
    with pytest.raises(SourceError, match="acc, acevo"):
        live_source("forza")


def test_unknown_source_in_env_stops_the_cli(monkeypatch):
    monkeypatch.setenv("SIMRACE_SOURCE", "forza")
    with pytest.raises(SystemExit, match="SIMRACE_SOURCE=forza"):
        cli.main(["probe"])


def test_cli_rejects_an_unknown_source_argument():
    with pytest.raises(SystemExit):
        cli.main(["record", "--out", "x.jsonl", "--source", "forza"])
